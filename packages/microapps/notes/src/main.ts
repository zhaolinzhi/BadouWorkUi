import React from 'react';
import { App } from './App';
import {
  clearActiveProps,
  clearAppLocalStorage,
  createAppContext,
  createMicroAppRenderer,
  isQiankunHost,
  setActiveProps,
  type RenderProps,
} from '@aionui/microapp-shared';
import './styles/global.css';

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
  try {
    const mockProps: RenderProps = {
      token: localStorage.getItem('aionui_token') ?? '',
      userInfo: { id: '', username: 'dev', permissions: [], tenantId: 'dev' },
      systemCode: 'aionui',
      baseApi: '/api',
      shellVersion: '0.0.0',
      theme: (localStorage.getItem('aionui_theme') as 'light' | 'dark') ?? 'light',
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
}
