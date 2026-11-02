import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';
import UnoCSS from 'unocss/vite';
import path from 'node:path';

import { aionuiGlobalComponentsPlugin, aionuiSvgIconPlugin } from '../../ui/src/vite/index.ts';

/**
 * vite-plugin-qiankun 的 selector(`body script[type=module], head script[crossorigin=""]`)
 * 漏了 head 里的 `<script type="module">`(主要是 Vite 的 React Refresh runtime,
 * 由 @vitejs/plugin-react 注入)。这些 script 仍是原生 ESM,qiankun eval 时会报
 * `Cannot use import statement outside a module`。
 *
 * 这里在 qiankun 之后补一刀(与 notes 微应用同款,原因完全一致):
 * 1. React Refresh runtime:替换为 noop shim。qiankun eval 上下文里
 *    `import.meta.hot` 不存在,React Refresh HMR 本就跑不通,只保留 $RefreshReg$
 *    / $RefreshSig$ 全局 stub 让 React 19 dev 模式不报错即可。
 * 2. 其他 head module scripts(兜底):用 data URL dynamic import 包起来。
 *
 * 生产构建同样不受影响:Vite 的 index.html 产物里没有这些 module script。
 */
const REACT_REFRESH_NOOP = `<script>
  // qiankun 2.x 的 import-html-entry 会把 inline script 包在
  //   (function(window, self, globalThis){ ... }).bind(window.proxy)(window.proxy, window.proxy, window.proxy)
  // 里执行 — 这里的 'window' 是子应用沙箱 proxy,不是真正的 global window。
  // 而 plugin-react 注入的 preamble check 检查的是主应用域真正的 window.$RefreshReg$,
  // 所以必须用 indirect eval 拿真正 global。
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
          if (/@react-refresh/.test(content)) {
            return REACT_REFRESH_NOOP;
          }
          const base64 = Buffer.from(content).toString('base64');
          return `<script>import('data:text/javascript;base64,${base64}')</script>`;
        })
      );
    },
  },
};

/**
 * 为什么生产构建要排除 vite-plugin-qiankun 和 qiankunHeadModuleShim。
 *
 * 这两个插件只服务 dev server。它们的 `transformIndexHtml` 没有生产门控,
 * `vite build` 时照样会把入口改写成 inline `import('./assets/xxx.js')`,并靠
 * `(window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + '..')` 把相对路径补成绝对
 * —— 但那段前缀的注入条件是 `useDevMode && !isProduction`,生产下拿不到。
 *
 * 结果就是:inline `import()` 里的相对 specifier 会按 **shell 的 document base URL**
 * 解析,而不是子应用 entry 的 URL。dev 下 shell 是 http://localhost:5173、
 * 子应用在 7993,恰好还能撞对;打进安装包后 shell 是 file://,必然解析失败。
 *
 * 标准形态(生产)走的是 import-html-entry 的外部 script 分支:它会把
 * `<script src="./assets/xxx.js">` 对 entry URL 做绝对化(fetch + eval),
 * 生命周期则由 src/main.ts 挂到 `window.knowledgeBase` 上被
 * `getLifecyclesFromExports` 取到。
 */
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [
    react(),
    // 全局注册 @aionui/ui 的图标 / 按钮:<AppIcon />、<IconButton /> 不用再 import。
    // 必须在 react() 之前 —— 它 enforce:'pre',要赶在 babel 的 JSX 转换之前。
    aionuiGlobalComponentsPlugin(),
    // `*.svg?component` 编译成图标组件 —— 定制图标放在 @aionui/ui 的 svg 目录里,
    // 构建期转成普通 React 组件,运行时零开销。
    aionuiSvgIconPlugin(),
    // UnoCSS 必须在 qiankun 之前:transformIndexHtml 改写 HTML 时,
    // 需要 uno 的 virtual module 已经就绪。
    UnoCSS(),
    // 只在 dev server 装 vite-plugin-qiankun:原因见上方注释
    ...(command === 'serve' ? [qiankun('knowledge-base', { useDevMode: true }), qiankunHeadModuleShim] : []),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, '../../desktop/src/renderer'),
      '@common': path.resolve(__dirname, '../../desktop/src/common'),
      '@': path.resolve(__dirname, '../../desktop/src'),
      '@aionui/microapp-shared': path.resolve(__dirname, '../shared/src'),
      // 主应用与三个微应用共用的 UI 组件层(源码级共享)。
      '@aionui/ui': path.resolve(__dirname, '../../ui/src/index.ts'),
    },
  },
  server: {
    port: 7993,
    // 端口被占用时直接报错:默认行为是静默顺延到下一个端口,而主应用的
    // `getMicroAppConfig()` 仍按约定端口拼 entry,结果是一个查不出原因的空白页。
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
}));
