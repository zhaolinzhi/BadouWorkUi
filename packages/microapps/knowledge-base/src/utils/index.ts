/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * knowledge-base micro-app 工具 barrel
 *
 * 这些模块全部是从 shell(`packages/desktop/src/renderer/**`)复制并裁剪过的
 * 纯工具 / 只读 IPC 封装：微应用的 qiankun 沙箱独立打包，运行时 import shell
 * 模块取不到，所以每个文件都自带最小依赖，改动时按「文件顶部的裁剪说明」回溯
 * 原实现即可。
 */

// 平台 / 资源地址解析
export { isElectronDesktop, openExternalUrl, resolveBackendAssetUrl, resolveExtensionAssetUrl } from './platform';

// 助手头像
export {
  isBackendRelativeAssetPath,
  isLikelyLocalFilePath,
  resolveAssistantAvatar,
  type AssistantAvatar,
} from './assistantAvatar';

// Agent 目录（只读子集）
export {
  fetchManagedAgents,
  MANAGED_AGENTS_SWR_KEY,
  type AgentHandshake,
  type AgentManagementErrorDetails,
  type AgentManagementStatus,
  type AgentMetadata,
  type AgentSnapshotCheckKind,
  type AgentSnapshotCheckStatus,
  type AgentSource,
  type AgentSourceInfo,
  type AgentType,
  type ManagedAgent,
} from './agentTypes';

export { useManagedAgentRuntimeCatalog } from './useManagedAgents';

// Agent Logo 目录
export {
  AGENT_LOGOS_SWR_KEY,
  resolveAgentAvatar,
  resolveAgentLogo,
  useAgentLogos,
  type AgentLogoMap,
} from './agentLogo';

// 助手编辑器可选项
export {
  buildAssistantEditorBackends,
  type AvailableBackend,
  type AvailableBackendModelOption,
} from './assistantUtils';

// 外部 AIPaaS 链接
export {
  AIPAAS_BASE_URL,
  EXTERNAL_LOGIN_URL_BASE,
  getKnowledgeBaseCreateUrl,
  getKnowledgeBaseEditUrl,
  getKnowledgeBaseViewUrl,
} from './api';

// 主进程 IPC bridge 访问层（其它文件都从这里取 `ipcBridge` / `getBaseUrl`）
export {
  getBaseUrl,
  getShellWindow,
  ipcBridge,
  type AcpConversationBridge,
  type DialogBridge,
  type FsBridge,
  type ShellBridge,
  type ShowOpenOptions,
} from './ipc';
