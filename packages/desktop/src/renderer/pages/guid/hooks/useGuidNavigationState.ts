import { useLocation } from 'react-router-dom';
import type { GuidNavigationState } from '../GuidPage';

export type ParsedGuidNavigationState = {
  projectId: string | undefined;
  projectName: string | undefined;
  requireBinding: boolean;
};

/**
 * 读取路由 state 中与项目绑定相关的字段。
 * 不复制其他字段 — 已有组件内联读取 `location.state as GuidNavigationState`。
 */
export const useGuidNavigationState = (): ParsedGuidNavigationState => {
  const location = useLocation();
  const state = (location.state ?? {}) as Partial<GuidNavigationState>;
  return {
    projectId: state.projectId,
    projectName: state.projectName,
    requireBinding: state.requireBinding === true,
  };
};