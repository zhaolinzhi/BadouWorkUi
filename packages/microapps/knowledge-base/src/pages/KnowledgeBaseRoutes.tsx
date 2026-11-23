/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库页面的路由层：路由表 + 页面级 Context。
 *
 * 为什么路由表放在 `pages/` 而不是 `src/router/`：
 * `src/` 已有 11 个直接子项（超过 AGENTS.md 的 ≤10 上限），再加目录会让
 * 存量超标更严重（ratchet 规则：本次改动不许让现状变差）。notes 微应用用的
 * `src/router/index.tsx`，在这里等价地落在 `pages/` 下。
 *
 * 为什么需要页面级 Context：
 * `createMemoryRouter` 的路由元素在**模块作用域**创建，拿不到
 * `KnowledgeBasePage` 里的 hook state。页面级 Context 把这些 state 与回调
 * 下发给路由元素 —— 与微应用既有的 `AppContext` 同一套路。
 *
 * import 方向：详情页只 `import type` 本文件的类型（编译期擦除，不产生运行时
 * 循环依赖）；运行时依赖（shell 的 token / navigate）走 `src/AppContext.tsx`。
 */

import type { KnowledgeBaseItem, KnowledgeBaseTab } from '../types';
import KnowledgeBaseDetailPage from './KnowledgeBaseDetailPage';
import KnowledgeBaseHomeTabs from './KnowledgeBaseHomeTabs';
import { createMemoryRouter, useNavigate } from 'react-router-dom';
import React, { createContext, useContext } from 'react';

/** 页面级共享状态与回调 —— 由 `KnowledgeBasePage` 提供。 */
export type KnowledgeBaseRuntime = {
  personalItems: KnowledgeBaseItem[];
  sharedItems: KnowledgeBaseItem[];
  personalLoading: boolean;
  personalError: string | null;
  sharedLoading: boolean;
  sharedError: string | null;
  /** 个人 / 共享两个列表是否都已完成首次加载。 */
  listLoaded: boolean;
  onRetryLoadPersonal: () => void;
  onRetryLoadShared: () => void;
  onRefresh: (tab: KnowledgeBaseTab) => void;
  onDelete: (item: KnowledgeBaseItem) => void;
  onOpenEdit: (item: KnowledgeBaseItem) => void;
  onCreate: () => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
};

const KnowledgeBaseRuntimeContext = createContext<KnowledgeBaseRuntime | null>(null);

export const KnowledgeBaseRuntimeProvider = KnowledgeBaseRuntimeContext.Provider;

/** 读取页面级共享状态。必须在 `KnowledgeBaseRuntimeProvider` 内使用。 */
export function useKnowledgeBaseRuntime(): KnowledgeBaseRuntime {
  const runtime = useContext(KnowledgeBaseRuntimeContext);
  if (!runtime) {
    throw new Error('useKnowledgeBaseRuntime must be used within <KnowledgeBaseRuntimeProvider>');
  }
  return runtime;
}

/** 首页路由：props 全部来自 Context；卡片点击改为跳详情页路由。 */
const KnowledgeBaseHomeRoute: React.FC = () => {
  const runtime = useKnowledgeBaseRuntime();
  const navigate = useNavigate();
  return (
    <KnowledgeBaseHomeTabs
      personalItems={runtime.personalItems}
      sharedItems={runtime.sharedItems}
      personalLoading={runtime.personalLoading}
      personalError={runtime.personalError}
      sharedLoading={runtime.sharedLoading}
      sharedError={runtime.sharedError}
      onRetryLoadPersonal={runtime.onRetryLoadPersonal}
      onRetryLoadShared={runtime.onRetryLoadShared}
      onRefresh={runtime.onRefresh}
      onDelete={runtime.onDelete}
      onOpenView={(item) => navigate(`/kb/${encodeURIComponent(item.id)}`)}
      onCreate={runtime.onCreate}
      onStartChat={runtime.onStartChat}
    />
  );
};

/** 详情页路由：把 Context 里的页面级状态作为 props 传给页面组件。 */
const KnowledgeBaseDetailRoute: React.FC = () => {
  const runtime = useKnowledgeBaseRuntime();
  return <KnowledgeBaseDetailPage runtime={runtime} />;
};

/**
 * 路由表工厂。
 *
 * 必须是**模块级稳定引用**：`createMemoryRouter()` 若在 React render 阶段被
 * 调用，子应用第二次打开时 react-router 内部的 `new DataRoutes()` 会抛
 * `TypeError: r.has is not a function`（私有字段走 WeakMap）。共享层的
 * `useRouter(base, factory)` 用 `useState` 惰性初值 + 按 base 缓存解决，
 * 见 `@aionui/microapp-shared` 的 qiankun/router.ts。
 */
export function createRouter(_routerBase: string) {
  return createMemoryRouter(
    [
      { path: '/', element: <KnowledgeBaseHomeRoute /> },
      { path: '/kb/:knowledgeBaseId', element: <KnowledgeBaseDetailRoute /> },
    ],
    { initialEntries: ['/'] }
  );
}
