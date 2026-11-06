import React from 'react';
import { setI18n } from 'react-i18next';
import { App } from './App';
import {
  adoptShellI18n,
  applyStandaloneTheme,
  clearAppLocalStorage,
  clearActiveProps,
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
import 'uno.css';
import './styles/global.css';
import { installStandaloneMockBridge } from './__qiankun__/standaloneMock';

/**
 * standalone(直接 `vite dev` 打开 7991)时的挂载点。
 *
 * 刻意**不叫 `#root`** —— shell 的 `index.html` 里就有 `<div id="root">`,
 * 一旦 host 判据出偏差就会把整个 shell 当成挂载点抹掉。
 */
const STANDALONE_ROOT_ID = 'meeting-recording-root';

const renderer = createMicroAppRenderer({
  name: 'meeting-recording',
  createContext: (props) => createAppContext(props),
  onContextCreated: (context) => setActiveProps(context),
  onContextCleared: (props) => {
    clearActiveProps();
    clearAppLocalStorage(props.systemCode);
  },
  renderApp: (_props, context) => React.createElement(App, { context, routerBase: '/' }),
});

export async function bootstrap() {
  // 接管 shell 的 i18next 实例。
  //
  // 子应用自带一份 react-i18next,默认拿不到 shell 初始化好的 i18n 实例 ——
  // `t(key, { defaultValue })` 会一直吐兜底文案(而且**不插值**,`{{count}}`
  // 会原样露在界面上)。`adoptShellI18n` 把 shell 的实例接过来,界面上的
  // 文案与插值才跟 shell 一致。
  adoptShellI18n(setI18n);
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
  // qiankun dev 模式(vite-plugin-qiankun 注入的 HTML 包装会读这个对象绑定 proxy)
  const lifeCycles = { bootstrap, mount, unmount };
  w.moudleQiankunAppLifeCycles = w.moudleQiankunAppLifeCycles || {};
  w.moudleQiankunAppLifeCycles['meeting-recording'] = lifeCycles;
  // 生产构建的 index.html 不带 vite-plugin-qiankun 的包装(见 vite.config.ts 注释),
  // qiankun 走 `getLifecyclesFromExports` 的 window[name] 兜底分支 —— 必须挂到全局。
  // 名字要和 MICRO_APP_DEFAULTS 里的 name 一致。
  w['meeting-recording'] = lifeCycles;
} else {
  // 独立运行。用 async IIFE 而不是顶层 await:Vite 产物的 esbuild target 是
  // es2020,顶层 await 会让构建直接失败。
  void (async () => {
    try {
      if (import.meta.env.DEV) {
        // 独立运行时没有宿主,`window.ipcBridge` 不存在 —— 而录音列表在
        // **挂载时**就要取 bridge 取列表,取不到就抛错,整页会被 React error
        // boundary 接管("Unexpected Application Error!")。这里自己当自己的宿主,
        // 装一份内存假 bridge,让 standalone dev 至少能正常调 UI。
        //
        // 只在 dev 装:生产产物由宿主提供真 bridge,脱离宿主直接打开时宁可报错,
        // 也不要拿假数据糊弄人(见 `__qiankun__/standaloneMock.ts` 的注释)。
        installStandaloneMockBridge();

        // shell 提供的样式(Arco 基础样式 + 主题变量 + 主题覆盖)在独立运行时
        // 全部缺席,页面就是一堆没上妆的 HTML。这里把它们补上。
        //
        // 样式与主题由共享包提供(三个微应用共用一份),被 shell 托管时这段代码
        // 根本不执行,样式仍然只由 shell 提供一份。
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
      // 独立运行失败时（例如测试环境没有挂载点）静默跳过；
      // qiankun 主应用会通过 mount() 显式调用，不会走到这里。
      // eslint-disable-next-line no-console
      console.warn('[meeting-recording] standalone bootstrap skipped:', err);
    }
  })();
}
