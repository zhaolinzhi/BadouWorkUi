import React from 'react';
import { App } from './App';
import {
  applyStandaloneTheme,
  clearActiveProps,
  clearAppLocalStorage,
  createAppContext,
  createMicroAppRenderer,
  isQiankunHost,
  loadStandaloneStyles,
  resolveStandaloneTheme,
  setActiveProps,
  type RenderProps,
} from '@aionui/microapp-shared';
// `uno.css` 是 UnoCSS 的虚拟模块入口:不 import 它,UnoCSS 不知道要把工具类
// 生成到哪个入口(插件会警告 "Entry module not found"),产物里也不会有那一份 CSS。
// shell 侧的 `main.tsx` 有同样的 import。
import 'uno.css';
import './styles/global.css';
import { installStandaloneMockBridge } from './__qiankun__/standaloneMock';

/**
 * standalone(直接 `vite dev` 打开 7992)时的挂载点。
 *
 * 刻意**不叫 `#root`** —— shell 的 `index.html` 里就有 `<div id="root">`,
 * 一旦 host 判据出偏差就会把整个 shell 当成挂载点抹掉。这里用子应用私有的 id,
 * 与 shell 永不同名。
 */
const STANDALONE_ROOT_ID = 'notes-root';

const renderer = createMicroAppRenderer({
  name: 'notes',
  createContext: (props) => createAppContext(props),
  onContextCreated: (context) => setActiveProps(context),
  onContextCleared: (props) => {
    clearActiveProps();
    clearAppLocalStorage(props.systemCode);
  },
  renderApp: (_props, context) => React.createElement(App, { context, routerBase: '/' }),
});

export async function bootstrap() {
  // 一次性初始化(预加载、注册全局事件等)
}

export async function mount(props: RenderProps) {
  renderer.render(props);
}

export async function unmount(props: RenderProps) {
  renderer.unmount(props);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
if (isQiankunHost()) {
  // dev 模式:vite-plugin-qiankun 注入的 HTML 包装读 `window.moudleQiankunAppLifeCycles`
  const lifeCycles = { bootstrap, mount, unmount };
  w.moudleQiankunAppLifeCycles = w.moudleQiankunAppLifeCycles || {};
  w.moudleQiankunAppLifeCycles['notes'] = lifeCycles;
  // 生产构建的 index.html 不带 vite-plugin-qiankun 的包装(见 vite.config.ts 注释),
  // qiankun 走 `getLifecyclesFromExports` 的 window[name] 兜底分支 —— 必须挂到全局。
  // 名字要和 MICRO_APP_DEFAULTS 里的 name 一致。
  w['notes'] = lifeCycles;
} else {
  // 独立运行。用 async IIFE 而不是顶层 await:Vite 产物的 esbuild target 是
  // es2020,顶层 await 会让构建直接失败。
  void (async () => {
    try {
      if (import.meta.env.DEV) {
        // 独立运行时没有宿主,`window.ipcBridge` 不存在 —— 而 `useNotebookList`
        // 在**渲染期**就取 bridge,取不到就抛错,整页会被 React error boundary
        // 接管("Unexpected Application Error!")。这里自己当自己的宿主,装一份
        // 内存假 bridge,让 standalone dev 至少能正常调 UI。
        //
        // 只在 dev 装:生产产物由宿主提供真 bridge,脱离宿主直接打开时宁可报错,
        // 也不要拿假数据糊弄人(见 `__qiankun__/standaloneMock.ts` 的注释)。
        installStandaloneMockBridge();

        // shell 提供的样式(Arco 基础样式 + 主题变量 + 主题覆盖)在独立运行时
        // 全部缺席,页面就是一堆没上妆的 HTML。这里把它们补上。
        //
        // 样式与主题由共享包提供(三个微应用共用一份),被 shell 托管时这段代码
        // 根本不执行,样式仍然只由 shell 提供一份 —— 若无条件打包,子应用的 CSS
        // 会被注入到真实 document 末尾,排在 shell 的主题覆盖之后,等于把覆盖又盖回去。
        //
        // 也只在 dev 加载:生产产物脱离宿主打开本来就跑不起来(没有真 bridge),
        // 这份样式跟着产物走只是白白多出一个没人加载的 CSS chunk。
        await loadStandaloneStyles();
      }
      const theme = resolveStandaloneTheme();
      // 把外观写到 document 上,主题 CSS 变量与 Arco 暗色样式才会生效
      applyStandaloneTheme(theme);
      const mockProps: RenderProps = {
        token: localStorage.getItem('aionui_token') ?? '',
        userInfo: { id: '', username: 'dev', permissions: [], tenantId: 'dev' },
        systemCode: 'aionui',
        baseApi: '/api',
        shellVersion: '0.0.0',
        theme,
        locale: localStorage.getItem('aionui_locale') ?? 'zh-CN',
        // 独立运行时没有 shell 的 LayoutContext,按 shell 的 768px 断点自行判定
        isMobile: typeof window === 'undefined' ? false : window.innerWidth < 768,
        on: () => () => {},
        emit: () => {},
        navigate: (path: string) => {
          window.history.pushState({}, '', path);
        },
        navigateExternal: (path: string) => {
          window.location.href = path;
        },
        container: `#${STANDALONE_ROOT_ID}`,
      };
      renderer.render(mockProps);
    } catch (err) {
      // standalone 启动失败(测试环境没有挂载点等)时静默跳过;
      // qiankun 主应用会通过 mount() 显式调用,不会走到这里。
      // eslint-disable-next-line no-console
      console.warn('[notes] standalone bootstrap skipped:', err);
    }
  })();
}
