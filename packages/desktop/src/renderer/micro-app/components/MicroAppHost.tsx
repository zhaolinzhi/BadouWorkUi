import React, { useContext, useEffect, useRef } from 'react';
import { loadMicroApp, type MicroApp } from 'qiankun';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '@renderer/hooks/context/AuthContext';
import { ThemeContext } from '@renderer/hooks/context/ThemeContext';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
// 副作用模块:必须在 loadMicroApp 之前把 ipcBridge / i18n 实例挂到 window 上,
// 子应用才能通过间接 eval 拿到它们。详见各文件顶部注释。
import '../services/expose-ipc-bridge';
import '../services/expose-i18n';
import { getEventBus } from '../services/event-bus';
import { resolveBaseApi } from '../services/micro-apps';
import type { MicroAppProps } from '../types';

/** 把任意异常压成一行可读文本(控制台输出用)。 */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** 把任意异常统一成 Error(状态上报用,保证外层拿得到 message)。 */
function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(toErrorMessage(err));
}

/**
 * 子应用挂载状态。
 *
 * `loading` — 正在加载 / 挂载(此时容器还是空的,界面上是白屏);
 * `mounted` — 挂载完成,容器里已经有子应用内容;
 * `failed`  — 加载或挂载失败,容器永远不会有内容。
 */
export type MicroAppMountState = 'loading' | 'mounted' | 'failed';

/**
 * mountPromise resolve 之后再多等这么久才判定「挂载完成」。
 *
 * 子应用的 mount 里一般是 `createRoot(container).render(...)`,React 的首次
 * 提交是异步的 —— mountPromise resolve 时内容还没画出来。立刻撤掉 loading
 * 会闪一下空白,等一小段时间让内容先落地。
 */
const MOUNT_SETTLE_DELAY_MS = 120;

export interface MicroAppHostProps {
  name: string;
  entry: string;
  container: string;
  activeRule: string;
  /** 显式覆盖。留空则从 shell 的 React Context 快照当前用户态 / 主题 / 语言。 */
  props?: Partial<MicroAppProps>;
  /**
   * 挂载状态回调,供外层显示 loading / 错误遮罩。
   *
   * 刻意**不进 useEffect 依赖**:调用方通常传内联箭头函数,进依赖会导致
   * 每次父组件渲染都重挂子应用(丢掉子应用内部状态)。这里用 ref 转发最新值。
   */
  onMountStateChange?: (state: MicroAppMountState, error?: Error) => void;
}

/**
 * 真正驱动 qiankun loadMicroApp 的组件。
 * MicroAppPlaceholder 渲染容器节点后，MicroAppHost 加载子应用。
 */
export const MicroAppHost: React.FC<MicroAppHostProps> = ({
  name,
  entry,
  container,
  activeRule,
  props,
  onMountStateChange,
}) => {
  const microAppRef = useRef<MicroApp | null>(null);
  const navigate = useNavigate();

  /*
   * 状态回调走 ref 转发,而不是直接进 useEffect 依赖:
   * 调用方传的是内联箭头函数,进依赖会让每次父组件渲染都重挂子应用。
   * 这个 effect 不带依赖,每次渲染后把最新回调写进 ref。
   */
  const onMountStateChangeRef = useRef(onMountStateChange);
  useEffect(() => {
    onMountStateChangeRef.current = onMountStateChange;
  });

  /*
   * 直接读裸 Context 而不是 useAuth() / useThemeContext():后两者在缺少
   * Provider 时会 throw,而 MicroAppHost 的单测就是裸渲染的。裸 Context
   * 返回 null,天然兜底。
   */
  const auth = useContext(AuthContext);
  const themeContext = useContext(ThemeContext);
  const { i18n } = useTranslation();
  // `isMobile` 只存在于 shell 的 React Context 里,子应用在 qiankun 沙箱里拿不到
  // Provider,所以在这里快照一份塞进 props。
  const layoutContext = useLayoutContext();

  /*
   * 用户态 / 主题 / 语言在**首次渲染**时快照一次,之后不再更新。
   *
   * 刻意不跟随变化:把它们写进 useEffect 依赖会导致任何一项变化都整体重挂
   * 子应用(丢失列表滚动位置、编辑到一半的表单)。token 真正失效时子应用
   * 发 401 → `auth:expired` 事件 → shell 统一登出,而不是靠这里重挂。
   *
   * 用 lazy ref 而不是 useMemo:useMemo 只是性能提示,React 允许丢弃缓存,
   * 语义上并不保证"只算一次";ref 的 lazy 初始化才是这个语义。
   */
  const snapshotRef = useRef<Pick<MicroAppProps, 'token' | 'userInfo' | 'theme' | 'locale' | 'isMobile'> | null>(null);
  if (snapshotRef.current === null) {
    snapshotRef.current = {
      token: auth?.user?.token ?? '',
      userInfo: {
        id: auth?.user?.id ?? '',
        username: auth?.user?.username ?? '',
        /*
         * shell 的 `AuthUser` 只有 id / username / token 三个字段,拿不到
         * avatar / permissions / tenantId。子应用消费这三项之前必须容忍空值。
         */
        avatar: undefined,
        permissions: [],
        tenantId: '',
      },
      theme: themeContext?.theme ?? 'light',
      locale: i18n?.language ?? 'zh-CN',
      isMobile: layoutContext?.isMobile ?? false,
    };
  }

  // 逐字段解构:`props` 对象本身每次渲染都是新引用,进依赖会无限重挂。
  const {
    token,
    userInfo,
    systemCode,
    baseApi,
    shellVersion,
    theme,
    locale,
    isMobile,
    on,
    emit,
    navigate: navigateOverride,
    navigateExternal,
  } = props ?? {};

  useEffect(() => {
    let cancelled = false;
    let mountedTimer: ReturnType<typeof setTimeout> | undefined;
    const snapshot = snapshotRef.current;
    const bus = getEventBus();
    /** 把挂载状态报给外层(loading 覆盖层 / 失败提示)。卸载后不再上报。 */
    const report = (state: MicroAppMountState, error?: Error) => {
      if (cancelled) return;
      const notify = onMountStateChangeRef.current;
      if (!notify) return;
      // 没有错误时只传状态:调用方按参数个数断言时不会因为多一个 undefined 而失配。
      if (error) notify(state, error);
      else notify(state);
    };
    const microAppProps: MicroAppProps = {
      token: token ?? snapshot?.token ?? '',
      userInfo: userInfo ?? snapshot?.userInfo ?? { id: '', username: '', permissions: [], tenantId: '' },
      systemCode: systemCode ?? 'aionui',
      /*
       * baseApi 必须是**能打到后端的绝对地址**(Electron 下是
       * `http://127.0.0.1:<__backendPort>/api`)。这里原来是相对路径 `/api`,
       * 于是子应用自己发的请求(例如笔记编辑器粘贴图片时 Vditor 的
       * `/api/fs/upload`)会打到 renderer 自己的源 —— dev 下是 Vite dev
       * server(404),打包后是 file:// 相对路径(直接失败)。
       */
      baseApi: baseApi ?? resolveBaseApi(),
      shellVersion: shellVersion ?? '0.0.0',
      theme: theme ?? snapshot?.theme ?? 'light',
      locale: locale ?? snapshot?.locale ?? 'zh-CN',
      isMobile: isMobile ?? snapshot?.isMobile ?? false,
      // 兜底走全局单例总线,不是 noop —— 否则子应用的 `emit('auth:expired')`
      // 会发进一个没有订阅者的实例,token 过期时不会登出。
      on: on ?? bus.on,
      emit: emit ?? bus.emit,
      navigate: navigateOverride ?? navigate,
      navigateExternal: navigateExternal ?? navigate,
    };

    try {
      report('loading');

      const app = loadMicroApp(
        {
          name,
          entry,
          container,
          props: microAppProps,
        },
        {}
      );
      if (cancelled) {
        void app.unmount();
        return;
      }
      microAppRef.current = app;

      /*
       * 子应用加载/挂载失败全是**异步**的:`loadMicroApp` 本身不抛,entry 拉不到、
       * 生命周期超时都发生在它返回之后。而 qiankun 这条链路上 mount 超时默认
       * `dieOnTimeout: false` —— 失败只是让容器一直空着,界面上就是一个白屏,
       * 控制台除了 single-spa 的超时警告之外没有任何线索(警告里只有
       * "minified message #31" 这种编号,查不到是哪一步断的)。
       *
       * 这里把两段 promise 的失败原因都打出来:白屏时能直接看出是「entry 拉不到」
       * 还是「挂载超时」,以及是哪个应用、entry 指向哪里。
       *
       * 同时把状态报给外层:挂载期间容器是空的(只有 qiankun 的空 wrapper),
       * 不给反馈就是白屏;挂载完成后才把 loading 收掉。
       */
      app.loadPromise?.catch((err: unknown) => {
        console.error(`[MicroAppHost] "${name}" 加载失败(entry: ${entry}):`, toErrorMessage(err));
        report('failed', toError(err));
      });
      app.mountPromise?.then(
        () => {
          /*
           * 子应用的 `mount` 里通常是 `createRoot(container).render(...)`:
           * React 的首次提交是**异步**的,mountPromise resolve 时容器里可能
           * 还没画出内容。立刻撤掉 loading 会闪一下空白,所以多等一小段,
           * 让子应用先把内容画出来。
           */
          mountedTimer = setTimeout(() => {
            mountedTimer = undefined;
            report('mounted');
          }, MOUNT_SETTLE_DELAY_MS);
        },
        (err: unknown) => {
          console.error(`[MicroAppHost] "${name}" 挂载失败:`, toErrorMessage(err));
          report('failed', toError(err));
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MicroAppHost] failed to load "${name}":`, message);
      report('failed', toError(err));
    }

    return () => {
      cancelled = true;
      if (mountedTimer !== undefined) {
        clearTimeout(mountedTimer);
        mountedTimer = undefined;
      }
      if (microAppRef.current) {
        try {
          void microAppRef.current.unmount();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[MicroAppHost] unmount "${name}" failed:`, message);
        }
        microAppRef.current = null;
      }
    };
  }, [
    name,
    entry,
    container,
    navigate,
    token,
    userInfo,
    systemCode,
    baseApi,
    shellVersion,
    theme,
    locale,
    isMobile,
    on,
    emit,
    navigateOverride,
    navigateExternal,
  ]);

  // activeRule 用于标记当前激活的子应用（debug 用）
  return <div data-micro-app-host={name} data-active-rule={activeRule} style={{ display: 'none' }} />;
};
