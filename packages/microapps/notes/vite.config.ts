import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';
import path from 'node:path';

/**
 * vite-plugin-qiankun 的 selector(`body script[type=module], head script[crossorigin=""]`)
 * 漏了 head 里的 `<script type="module">`(主要是 Vite 的 React Refresh runtime,
 * 由 @vitejs/plugin-react 注入)。这些 script 仍是原生 ESM,qiankun eval 时会报
 * `Cannot use import statement outside a module`。
 *
 * 这里在 qiankun 之后补一刀:
 * 1. React Refresh runtime:替换为 noop shim。因为 data: URL 不是 hierarchical scheme,
 *    `/@react-refresh` 绝对路径在动态 import 里无法解析。而 qiankun eval 上下文里
 *    `import.meta.hot` 不存在,React Refresh HMR 本就跑不通,只保留 $RefreshReg$
 *    / $RefreshSig$ 全局 stub 让 React 18 dev 模式不报错即可。
 * 2. 其他 head module scripts(兜底,理论上不会有):用 data URL dynamic import 包起来,
 *    让 qiankun eval 不再触发 SyntaxError。
 *
 * UMD 构建路径不受影响(Vite 产出的 UMD bundle 没有这些 module script)。
 */
const REACT_REFRESH_NOOP = `<script>
  // qiankun 2.x 的 import-html-entry 会把 inline script 包在
  //   (function(window, self, globalThis){ ... }).bind(window.proxy)(window.proxy, window.proxy, window.proxy)
  // 里执行 — 这里的 'window' 是子应用沙箱 proxy,不是真正的 global window
  // 而 plugin-react 注入的 preamble check(在 import('/src/main.ts') 后的 ES module 里)
  // 检查的是主应用域真正的 window.$RefreshReg$,所以必须用 indirect eval 拿真正 global
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
          // React Refresh runtime:noop 掉(qiankun eval 上下文跑不通 HMR)
          if (/@react-refresh/.test(content)) {
            return REACT_REFRESH_NOOP;
          }
          // 兜底:其它 head module scripts 用 data URL 包成 dynamic import
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
    // dev 模式兼容 qiankun 加载:把入口 HTML/JS 重写为 qiankun 可 eval 的形式
    // 详见 docs/qiankun/03-dev-mode.md#34-dev-模式子应用配置要求
    qiankun('notes', { useDevMode: true }),
    // 补丁:补齐 vite-plugin-qiankun 漏掉的 head module scripts
    qiankunHeadModuleShim,
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, '../../desktop/src/renderer'),
      '@common': path.resolve(__dirname, '../../desktop/src/common'),
      '@': path.resolve(__dirname, '../../desktop/src'),
      '@aionui/microapp-shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 7992,
    // 端口被占用时直接报错:默认行为是静默顺延到下一个端口,而主应用的
    // `getMicroAppConfig()` 仍按约定端口拼 entry,结果是一个查不出原因的空白页。
    strictPort: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'notes',
      formats: ['umd'],
      fileName: () => 'notes.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom', '@arco-design/web-react'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
          '@arco-design/web-react': 'ArcoDesign',
        },
      },
    },
  },
});
