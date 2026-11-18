/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Platform detection utilities
 * 平台检测工具函数
 *
 * 从 shell(`packages/desktop/src/renderer/utils/platform.ts`)复制而来,
 * 去掉 knowledge-base 用不到的 `isMacOS` / `isWindows` / `isLinux` /
 * `getChromeLikeUserAgent`,并把 `getBaseUrl` / `ipcBridge` 换成微应用自己的
 * `./ipc`(shell 的 `@/common` 在 qiankun 沙箱里取不到,见 ipc.ts 顶部长注释)。
 */

import { getBaseUrl, getShellWindow, ipcBridge } from './ipc';

/**
 * Check if running in Electron desktop environment
 * 检测是否运行在 Electron 桌面环境
 */
export const isElectronDesktop = (): boolean => {
  if (typeof window === 'undefined') return false;
  // `window.electronAPI` 由 preload 的 contextBridge 注入。沙箱 Proxy 的 get
  // 兜底通常能读到,但显式读真实 window 更稳(与 ipc.ts 的取窗方式一致)。
  return Boolean((getShellWindow() as { electronAPI?: unknown } | undefined)?.electronAPI);
};

function isAbsoluteAssetUrl(url: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//');
}

/**
 * Resolve a backend-served asset URL for the current environment.
 * In Electron, renderer pages are file:// based, so backend-relative paths
 * must be expanded against the backend HTTP origin.
 */
export const resolveBackendAssetUrl = (url: string | undefined): string | undefined => {
  if (!url) return url;
  if (isAbsoluteAssetUrl(url) || /^data:/i.test(url)) return url;
  if (url.startsWith('/')) {
    return isElectronDesktop() ? `${getBaseUrl()}${url}` : url;
  }
  return url;
};

/**
 * Resolve an extension asset URL for the current environment.
 * Backend-managed extension assets are already emitted as HTTP URLs, so this
 * helper resolves app-relative backend paths into absolute backend URLs when
 * the desktop renderer is not same-origin with the backend process.
 *
 * 将扩展资源 URL 转换为当前环境可用的地址
 */
export const resolveExtensionAssetUrl = (url: string | undefined): string | undefined => {
  return resolveBackendAssetUrl(url);
};

/**
 * Open external URL in the appropriate context
 * - Electron: uses shell.openExternal via IPC (opens on local machine)
 * - WebUI: uses window.open in client browser (opens on remote client)
 *
 * 在适当的环境中打开外部链接
 * - Electron: 通过 IPC 调用 shell.openExternal（在本地机器打开）
 * - WebUI: 使用 window.open 在客户端浏览器打开（在远程客户端打开）
 */
export const openExternalUrl = async (url: string): Promise<void> => {
  if (!url) return;

  if (isElectronDesktop()) {
    await ipcBridge.shell.openExternal.invoke(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
