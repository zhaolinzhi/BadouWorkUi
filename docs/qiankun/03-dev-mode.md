# 03. dev 模式子应用配置(vite-plugin-qiankun + shim + indirect eval)

> 适用对象:子应用开发者,或主应用开发者遇到 dev 模式 `Cannot use import statement outside a module` / `@vitejs/plugin-react can't detect preamble` 报错。
>
> 排查清单见 [09-faq.md](09-faq.md),这里是原理 + 修复实现。

## 3.4 dev 模式子应用配置要求

> ⚠️ **每个接入 qiankun 的子应用都必须装 [`vite-plugin-qiankun`](https://github.com/tengmaoqing/vite-plugin-qiankun) 并在 `main.ts` 注册生命周期**,否则主应用 `loadMicroApp` 会在 dev 模式下报错。

### 为什么需要这个插件

Vite dev server 输出的是原生 ESM(带裸 `import`),qiankun 的 `import-html-entry` 抓取 entry HTML 后把 script 字符串 `eval()` 跑,裸 `import` 在非 module 上下文直接报:

```
Uncaught (in promise) SyntaxError: Cannot use import statement outside a module
    at eval (<anonymous>)
    at evalCode (qiankun.js:1773:31)
    at geval2 (qiankun.js:2164:7)
    at exec (qiankun.js:2176:11)
```

> 注意:UMD 构建路径(`bun run build` 出的 `dist/<name>.js`)**不需要**这个插件,UMD 是单文件,global 挂在 `window.<name>` 上,qiankun 直接调 `window.<name>.mount(props)`。

### 子应用 `vite.config.ts` 配置

```ts
// packages/microapps/<name>/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';

export default defineConfig({
  plugins: [
    react(),
    // dev 模式兼容 qiankun 加载:重写入口 HTML/JS,让 qiankun 可 eval
    // UMD 构建路径不受影响
    qiankun('<name>', { useDevMode: true }),
  ],
  // ...resolve / server / build.lib / external 等
});
```

### 子应用 `main.ts` 注册生命周期

`vite-plugin-qiankun` 注入的 HTML 包装会读 `window.moudleQiankunAppLifeCycles['<name>']` 拿到 `bootstrap / mount / unmount`,所以 `main.ts` 顶部需要:

```ts
// qiankun dev 模式:把生命周期挂到 window.moudleQiankunAppLifeCycles 上
// vite-plugin-qiankun 注入的 HTML 包装会读这个对象绑定 proxy
// (UMD 构建路径不走这里,UMD 直接 window.<name>.mount(props))
const w = window as any;
if (w.__POWERED_BY_QIANKUN__) {
  w.moudleQiankunAppLifeCycles = w.moudleQiankunAppLifeCycles || {};
  w.moudleQiankunAppLifeCycles['<name>'] = { bootstrap, mount, unmount };
} else {
  // 独立运行时:mock props 直接 render
  render(mockProps);
}
```

> 这段是 dev + qiankun 模式专用。独立运行时走 `else` 分支(原 `__POWERED_BY_QIANKUN__` 守卫),UMD 构建时由 `vite.config.ts` 的 `build.lib` 处理 `window.<name>` 挂载。

### ⚠️ 还需要 head module shim 补丁

`vite-plugin-qiankun@1.0.15` 的 selector 是 `body script[type=module], head script[crossorigin=""]`,**漏了 head 里无 `crossorigin` 的 `<script type="module">`**(主要是 `@vitejs/plugin-react` 注入的 React Refresh runtime)。这些 script 仍是原生 ESM,qiankun eval 仍会报 `SyntaxError`。

**症状**:装了 `vite-plugin-qiankun` 也配了 `useDevMode: true`,主应用还是报 `Cannot use import statement outside a module`,堆栈指向 `eval → qiankun.js:evalCode`,且错误来自 React Refresh 的 inline script(`import { injectIntoGlobalHook } from "/@react-refresh"`)。

**修复**:在 `vite.config.ts` 的 plugins 数组里,`qiankun(...)` 之后**追加**一个补丁 plugin。React Refresh runtime 直接 noop 掉(因为 qiankun eval 上下文里没有 Vite HMR,`import.meta.hot` 不存在,React Refresh HMR 本就跑不通),其他 head module scripts 兜底用 data URL dynamic import:

```ts
// packages/microapps/<name>/vite.config.ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';
import path from 'node:path';

// React Refresh 在 qiankun eval 上下文里跑不通 HMR,只给全局 stub 防 React 报错
// ⚠️ 关键:必须用 indirect eval 拿真正 global window,因为 qiankun 2.x 的 import-html-entry
// 会把 inline script 包在 (function(window, self, globalThis){ ... }).bind(window.proxy)(...)
// 里执行,这里的 'window' 是子应用沙箱 proxy,不是真正的 global window。
// 而 plugin-react 注入的 preamble check(在 import('/src/main.ts') 后的 ES module 里)
// 检查的是主应用域真正的 window.$RefreshReg$,所以必须用 indirect eval 拿真正 global。
const REACT_REFRESH_NOOP = `<script>
  (function() {
    var w = (0, eval)('window');
    w.$RefreshReg$ = (t) => t;
    w.$RefreshSig$ = () => (t) => t;
    w.$RefreshRuntime$ = new Proxy({}, { get: () => () => {} });
  })();
</script>`;

const qiankunHeadModuleShim: Plugin = {
  name: 'qiankun-head-module-shim',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      return html.replace(/<head>([\s\S]*?)<\/head>/i, (_headMatch, headContent) =>
        headContent.replace(/<script type="module">([\s\S]*?)<\/script>/g, (_scriptMatch, content) => {
          // React Refresh runtime:noop(避开 /@react-refresh 绝对路径解析问题)
          if (/@react-refresh/.test(content)) {
            return REACT_REFRESH_NOOP;
          }
          // 兜底:其它 head module scripts 用 data URL dynamic import
          const base64 = Buffer.from(content).toString('base64');
          return `<script>import('data:text/javascript;base64,${base64}')</script>`;
        })
      );
    },
  },
};

export default defineConfig({
  plugins: [
    react(),
    qiankun('<name>', { useDevMode: true }),
    qiankunHeadModuleShim, // ← 必须加在 qiankun 之后
  ],
  // ...
});
```

> **为什么 noop 掉 React Refresh 是安全的**:
>
> - qiankun eval 上下文里 `import.meta.hot` 不存在,Vite HMR 整体跑不通
> - React 18 dev 模式通过 `@vitejs/plugin-react` 的 Babel transform 在每个组件里调用 `$RefreshReg$(type, id)` 拿回原函数
> - 只要 `window.$RefreshReg$` / `$RefreshSig$` / `$RefreshRuntime$` 这三个全局存在(哪怕是 noop),React 就能正常渲染
> - HMR 热更新功能在 qiankun 模式下本来就没用,组件改动需要重新 mount 子应用
> - UMD 构建路径不受影响(`bun run build` 产出的 bundle 没有这些 module script)
>
> **为什么必须用 `indirect eval` 拿 window**:
>
> - qiankun 2.x 的 `import-html-entry` 把 inline script 包在 `(function(window, self, globalThis){ ... }).bind(window.proxy)(...)` 里执行
> - 这里的 `window` 是子应用沙箱的 proxy,设 `window.$RefreshReg$` 实际设到 `window.proxy.$RefreshReg$`
> - 但 `plugin-react` 注入的 preamble check 跑在主应用域的 ES module scope,检查的是**真正**的 global window
> - 所以必须用 `(0, eval)('window')` (indirect eval,在 global scope 执行)拿真正 window 再设

> UMD 构建路径不受影响(Vite 产出的 UMD bundle 没有这些 module script)。
> 如果将来 `vite-plugin-qiankun` 修复了这个 selector bug,这个 shim 就可以删了。

### 验证生效

启动子应用 dev server,curl 入口 HTML:

```bash
curl -s http://localhost:7992/ | head -30
```

应该看到形如:

```html
<script>
  const createDeffer = (hookName) => { ... }
  ;(global => {
    global['<name>'] = { bootstrap, mount, unmount, update };
  })(window);
</script>
...
<script>
  import((window.proxy ? (window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + '..') : '') + '/src/main.ts').finally(() => {
      const qiankunLifeCycle = window.moudleQiankunAppLifeCycles && window.moudleQiankunAppLifeCycles['<name>'];
      if (qiankunLifeCycle) { ... }
  })
</script>
```

看到 `createDeffer` + `moudleQiankunAppLifeCycles` 这两个特征 = 插件已生效。看不到 = 没装或没配 `useDevMode: true`。

还要确认 **head 里没有残留的 `<script type="module">`**(应该全部转成 `import('data:...')` 或 `import('/@vite/client')`)。如果还看到原生 `import` 语句在 head 里,说明 `qiankunHeadModuleShim` 没加或位置不对。
