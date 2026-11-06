/**
 * 运行时 AppContext 占位实现。Task 7 会扩展此文件,新增当前主题、
 * i18n locale、路由入口等 Provider 包装;此处仅暴露最基础的 props 透传。
 */
import { createContext, useContext } from 'react';
import type { MicroAppProps } from '@renderer/micro-app/types';

export type AppContextValue = MicroAppProps;

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within AppContext.Provider');
  }
  return ctx;
}
