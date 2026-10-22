/**
 * qiankun 挂载辅助 —— 两个微应用的 `main.ts` 共用。
 *
 * 这里修掉的是两个真实且致命的坑,两个微应用都踩过。
 *
 * 坑一:`props.container` 是 HTMLElement,不是选择器字符串
 * ====================================================
 * qiankun 在 `loader.js` 里是这样调生命周期的:
 *
 * ```js
 * return mount({ ...props, container: appWrapperGetter() });
 * ```
 *
 * `appWrapperGetter()` 返回的是 qiankun 自己创建的 wrapper **元素**
 * (`<div id="__qiankun_microapp_wrapper_for_<name>__">`,由 qiankun 的
 * `processTpl` 生成),不是用户传给 `loadMicroApp` 的选择器字符串。
 * 所以 `document.querySelector(props.container)` 会把元素 toString 成
 * `"[object HTMLDivElement]"` —— 这是个未闭合的属性选择器,
 * `querySelector` 直接抛 `SyntaxError: Invalid selector`,微应用永远
 * 渲染不出来。
 *
 * 坑二:`__POWERED_BY_QIANKUN__` 在 dev 模式下读不到
 * ================================================
 * `vite-plugin-qiankun` 的 `transformIndexHtml` 把
 * `<script type="module" src="/src/main.ts">` 改写成
 * `<script>import('/src/main.ts')</script>`(必须是 inline classic script,
 * 因为 qiankun 的 `execScripts` 用的是 `eval`,吃不了原生 ESM)。
 *
 * 于是 `/src/main.ts` 是以**原生 ESM** 身份加载的 —— 它运行在页面真实的
 * realm 里,`window` 是**真 window**。而 qiankun 只把
 * `__POWERED_BY_QIANKUN__` 打在**沙箱 proxy** 上,真 window 上没有。
 *
 * 结果:`if (window.__POWERED_BY_QIANKUN__)` 判定为 false → 走 standalone
 * 分支 → `document.getElementById('root')` → **命中 shell 自己的
 * `<div id="root">`** → `createRoot(shellRoot).render(...)` → 整个 shell
 * DOM 被抹掉,左侧 Sider 一起消失,DOM 里再也找不到。
 *
 * 正确的 host 判据是 `window.proxy`(qiankun 的 `patchWindowPropWithProxy`
 * 会把它挂到真 window 上),`vite-plugin-qiankun` 自己的 helper 也是用
 * `window.proxy` 来 deferred 生命周期的。
 *
 * 坑三:standalone 的挂载点不能叫 `#root`
 * ===================================
 * shell 的 `index.html` 里就有 `<div id="root">`。就算把坑二修好,只要
 * 判据再出一次偏差,`#root` 兜底就会再次吃掉整个 shell。所以 standalone
 * 分支改用子应用私有的 `#<name>-root`,与 shell 永不同名。
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MicroAppProps } from './types';

/** qiankun 传给生命周期的 container:真实元素(沙箱 wrapper)。 */
export type MountContainer = string | HTMLElement;

/** 生命周期实际收到的 props:`MicroAppProps` + qiankun 追加的 `container`。 */
export interface RenderProps extends MicroAppProps {
  container?: MountContainer;
}

/**
 * 是否运行在 qiankun 宿主里。
 *
 * - `window.proxy`:qiankun `patchWindowPropWithProxy` 挂在真 window 上的
 *   沙箱 proxy,dev + prod 都有。
 * - `window.__POWERED_BY_QIANKUN__`:UMD 路径下子应用代码跑在沙箱作用域里,
 *   读的是 proxy,也能命中。保留作为兜底。
 */
export function isQiankunHost(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { proxy?: unknown; __POWERED_BY_QIANKUN__?: unknown };
  return Boolean(w.proxy) || Boolean(w.__POWERED_BY_QIANKUN__);
}

/** 把 qiankun 的 `container`(元素或选择器)解析成可挂载的 DOM 节点。 */
export function resolveMountContainer(container: MountContainer | undefined): HTMLElement | null {
  if (!container) return null;
  if (typeof container === 'string') return document.querySelector<HTMLElement>(container);
  return container;
}

export interface MicroAppRendererOptions<TContext> {
  /** 子应用名,用于错误信息,如 `'notes'`。 */
  name: string;
  /**
   * 构造要渲染的 React 元素。第二个参数就是 `createContext` 的返回值
   * (同一个引用),消费方不要再自己调一次 `createContext` —— 两次调用会
   * 产出两个不同的 context 对象,导致 `setActiveProps` 缓存的和组件收到的
   * 对不上。
   */
  renderApp: (props: RenderProps, context: TContext) => React.ReactElement;
  /** 挂载前把 props 转成 AppContext 之类的对象。 */
  createContext?: (props: RenderProps) => TContext;
  /** `createContext` 之后、`root.render` 之前的副作用钩子(写模块级 props 缓存等)。 */
  onContextCreated?: (context: TContext, props: RenderProps) => void;
  /** unmount 时清模块级缓存 / 子应用私有的 localStorage 键。 */
  onContextCleared?: (props: RenderProps) => void;
}

/** 清掉某个子应用镜像到 localStorage 的 `${systemCode}_*` 键。 */
export function clearAppLocalStorage(systemCode: string | undefined): void {
  if (!systemCode) return;
  const prefix = `${systemCode}_`;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  }
}

export interface MicroAppRenderer {
  render: (props: RenderProps) => void;
  unmount: (props: RenderProps) => void;
}

/**
 * 造一套带 root 复用的 mount / unmount。
 *
 * `render` 幂等:重复调用先卸载上一个 root,再挂新的 —— qiankun 的
 * remount 流程会这么用。
 */
export function createMicroAppRenderer<TContext = undefined>(
  options: MicroAppRendererOptions<TContext>
): MicroAppRenderer {
  let rootInstance: Root | null = null;

  return {
    render(props: RenderProps): void {
      const container = resolveMountContainer(props.container);
      if (!container) {
        throw new Error(
          `[${options.name}] mount container is unavailable. ` +
            'qiankun must call mount() with a `container` (the app wrapper element).'
        );
      }

      if (rootInstance) {
        rootInstance.unmount();
        rootInstance = null;
      }

      const context = options.createContext ? options.createContext(props) : (undefined as TContext);
      options.onContextCreated?.(context, props);

      rootInstance = createRoot(container);
      rootInstance.render(options.renderApp(props, context));
    },

    unmount(props: RenderProps): void {
      if (rootInstance) {
        rootInstance.unmount();
        rootInstance = null;
      }
      options.onContextCleared?.(props);
      // 只清 qiankun 自己建的 wrapper 内容;standalone 的容器由 Vite HMR 复用,
      // 这里顺手清空以免下次 mount 看到旧 DOM。
      const container = resolveMountContainer(props.container);
      if (container) container.innerHTML = '';
    },
  };
}
