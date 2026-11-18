/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agent 管理目录的读取 hook(节选)—— 从 shell
 * (`packages/desktop/src/renderer/hooks/agent/useManagedAgents.ts`)复制而来。
 *
 * knowledge-base 只读目录,不写目录,所以只保留
 * `useManagedAgentRuntimeCatalog`。被裁掉的导出:
 *   - `useManagedAgents` / `UseManagedAgentsResult`:Agent 设置页专用的
 *     revalidate / refresh 动作集
 *   - `getManagedAgents` / `refreshManagedAgentRuntimeCatalogAndAssistants`:
 *     主动写 SWR 缓存,微应用不需要
 *
 * 被裁掉之后 `swr` 的 `mutate` 与 `ipcBridge` 都不再需要 import。
 */

import type { ManagedAgent } from './agentTypes';
import { MANAGED_AGENTS_SWR_KEY, fetchManagedAgents } from './agentTypes';
import useSWR from 'swr';

/**
 * Lightweight runtime catalog read model for assistant-bound agent rows.
 * Uses the same `/api/agents/management` payload because that endpoint is
 * backed by `agent_metadata`, where ACP catalog snapshots are persisted.
 */
export const useManagedAgentRuntimeCatalog = (): ManagedAgent[] => {
  const { data } = useSWR<ManagedAgent[]>(MANAGED_AGENTS_SWR_KEY, fetchManagedAgents);
  return data ?? [];
};
