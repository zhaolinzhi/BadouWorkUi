import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/context/AuthContext';
import { useThemeContext } from '../hooks/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { startMicroApps, isMicroAppEnabled } from './services/micro-apps';
import { getEventBus } from './services/event-bus';

/**
 * 启动 micro-app 的 React 组件。
 * 放在 AppProviders 内，确保能拿到 useAuth/useThemeContext/useTranslation。
 */
export const MicroAppBootstrap: React.FC = () => {
  const { user, notifyTokenExpired } = useAuth();
  const { theme } = useThemeContext();
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const bus = useMemo(() => getEventBus(), []);

  useEffect(() => {
    if (!isMicroAppEnabled()) return;
    if (!(window as { electronAPI?: unknown }).electronAPI) {
      // 仅 WebUI 模式启动
      startMicroApps({
        navigate,
        navigateExternal: navigate,
        on: bus.on,
        emit: bus.emit,
      });
    }
  }, [navigate, bus]);

  /**
   * 子应用请求接口拿到 401 后发 `auth:expired`,由 shell 统一收口:提示 +
   * 登出。子应用拿不到 `useAuth()`,自己处理会各写一套(而且清不干净
   * shell 侧的会话缓存),所以这个动作必须回到 shell 做。
   */
  useEffect(() => {
    if (!isMicroAppEnabled()) return;
    return bus.on('auth:expired', () => {
      notifyTokenExpired('knowledge-base');
    });
  }, [bus, notifyTokenExpired]);

  // 主题变化时广播
  useEffect(() => {
    if (!isMicroAppEnabled()) return;
    bus.emit('theme:change', { theme });
  }, [theme, bus]);

  // 语言变化时广播
  useEffect(() => {
    if (!isMicroAppEnabled()) return;
    bus.emit('locale:change', { locale: i18n.language });
  }, [i18n.language, bus]);

  // 当前用户态作为 props 默认值在 startMicroApps 内部不读取，
  // 这里仅保留引用避免 lint 警告
  void user;

  return null;
};
