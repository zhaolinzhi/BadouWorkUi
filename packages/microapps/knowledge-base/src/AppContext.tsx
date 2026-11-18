/**
 * 子应用运行时上下文。
 *
 * shell 侧原本通过三个 React hook 把状态喂给知识库:
 *   - `useAuth()`          → 拿 token(以及 token 过期时统一登出)
 *   - `useLayoutContext()` → 拿 isMobile
 *   - `openExternalUrl()`  → 跳厂商的创建 / 编辑 / 查看页
 *
 * 这三样都在 shell 的 React Provider / 模块作用域里,qiankun 沙箱里的子应用
 * 一个都够不着。所以改成:shell 在 mount 时把它们快照进 `MicroAppProps`
 * (见 `types.ts`),这里再用 Context 分发给组件。
 *
 * 为什么值得多一层 Context:`useKnowledgeBaseList` 这种 hook 里拿不到 props,
 * 而在每个组件里写 `useContext` 又会把数据层和 UI 层都拖进 shell 依赖。
 */
import React from 'react';
import type { MicroAppProps } from '@aionui/microapp-shared';

const AppRuntimeContext = React.createContext<MicroAppProps | null>(null);

/** 读取 shell 注入的运行时 props。 */
export function useAppRuntime(): MicroAppProps {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error('useAppRuntime must be used within <KnowledgeBaseApp>');
  }
  return context;
}

export const AppRuntimeProvider = AppRuntimeContext.Provider;
