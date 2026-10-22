/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 助手编辑器可选项构建(节选)—— 从 shell
 * (`packages/desktop/src/renderer/pages/settings/AssistantSettings/assistantUtils.ts`)
 * 复制而来。
 *
 * knowledge-base 只需要 `buildAssistantEditorBackends`(知识库编辑器的助手下拉
 * 数据源)。裁掉的导出是助手设置页专属的列表工具:`resolveAssistantSourceTag` /
 * `isEmoji` / `resolveAvatarImageSrc` / `sortAssistants` / `reorderAssistantList` /
 * `filterAssistants` / `groupAssistantsByEnabled` / `filterByEnabled` /
 * `groupMyAssistants` / `filterAssistantEditorBackends`。
 *
 * `AvailableBackend` / `AvailableBackendModelOption` 原本来自同目录的 `./types`，
 * 这里是助手设置页模块、微应用拿不到，所以原样搬进来(它们只有几行，且没有
 * 别的依赖)。
 */

import type { ManagedAgent } from './agentTypes';

/**
 * 助手下拉里单个可选项。
 * Copied from `packages/desktop/src/renderer/pages/settings/AssistantSettings/types.ts`.
 */
export type AvailableBackendModelOption = {
  value: string;
  label: string;
  description?: string;
};

/**
 * 助手编辑器的运行时后端选项。
 * Copied from `packages/desktop/src/renderer/pages/settings/AssistantSettings/types.ts`.
 */
export type AvailableBackend = {
  id: string;
  name: string;
  runtimeKey: string;
  isExtension?: boolean;
  /** Agent icon/avatar (raw value from the backend catalog), for the dropdown. */
  icon?: string;
  /** Custom agent id (e.g. `ext:name:adapter`), used to resolve extension logos. */
  customAgentId?: string;
  modelOptions: AvailableBackendModelOption[];
};

/// Agent types the assistant editor can drive.
///
/// This is a whitelist, so every new `AgentType` is invisible here until it is
/// added — which is how Antigravity ended up missing from the Agent dropdown
/// AND showing its raw id (`a9f3c21e`) instead of its name in the editor. Both
/// symptoms are this one line: an agent filtered out here never reaches
/// `availableBackends`, and `Select` with no matching Option falls back to
/// rendering the bare value.
///
/// `antigravity` is a first-class agent type rather than an `acp` backend
/// because agy is a direct-CLI integration (one process per turn), the same
/// reason it has its own variant in `AgentType`.
///
/// Excluded on purpose: `gemini` and `codex` are legacy read-only variants kept
/// so historical rows stay readable, and `remote` / `nanobot` /
/// `openclaw-gateway` are not editor-driven.
const ASSISTANT_EDITOR_AGENT_TYPES = new Set(['acp', 'aionrs', 'antigravity']);

const isAssistantEditorAgent = (agent: ManagedAgent): boolean => ASSISTANT_EDITOR_AGENT_TYPES.has(agent.agent_type);

export const buildAssistantEditorBackends = (
  agents: ManagedAgent[],
  localeKey: string,
  currentAgentId?: string
): AvailableBackend[] => {
  const backendMap = new Map<string, AvailableBackend>();

  for (const agent of agents) {
    if (!isAssistantEditorAgent(agent)) {
      continue;
    }

    const agentId = agent.id?.trim() || '';
    const status = agent.status;
    const isCurrent = Boolean(currentAgentId && agentId === currentAgentId);
    const isSelectable = agent.enabled !== false && (status === 'online' || status === 'unchecked');
    if (!agentId || backendMap.has(agentId) || (!isSelectable && !isCurrent)) {
      continue;
    }

    const runtimeKey = (agent.backend || agent.agent_type || '').trim();
    if (!runtimeKey) {
      continue;
    }

    backendMap.set(agentId, {
      id: agentId,
      name: agent.name_i18n?.[localeKey] || agent.name,
      runtimeKey,
      isExtension: agent.isExtension,
      // Prefer the agent's own avatar/icon; the dropdown falls back to the logo
      // catalog (keyed by runtimeKey) when this is empty.
      icon: agent.avatar || agent.icon,
      customAgentId: agent.custom_agent_id,
      modelOptions: [],
    });
  }

  return [...backendMap.values()];
};
