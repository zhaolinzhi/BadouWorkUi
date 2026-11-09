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

export interface MicroAppHostProps {
  name: string;
  entry: string;
  container: string;
  activeRule: string;
  /** 显式覆盖。留空则从 shell 的 React Context 快照当前用户态 / 主题 / 语言。 */
  props?: Partial<MicroAppProps>;
}

/**
 * 真正驱动 qiankun loadMicroApp 的组件。
 * MicroAppPlaceholder 渲染容器节点后，MicroAppHost 加载子应用。
 */
export const MicroAppHost: React.FC<MicroAppHostProps> = ({ name, entry, container, activeRule, props }) => {
  const microAppRef = useRef<MicroApp | null>(null);
  const navigate = useNavigate();

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
    const snapshot = snapshotRef.current;
    const bus = getEventBus();
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MicroAppHost] failed to load "${name}":`, message);
    }

    return () => {
      cancelled = true;
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
