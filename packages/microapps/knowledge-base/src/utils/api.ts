/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 外部 AIPaaS 链接构建(节选)—— 从 shell
 * (`packages/desktop/src/renderer/api/config.ts`)复制而来。
 *
 * knowledge-base 只需要知识库的新建 / 编辑 / 查看外链。裁掉的是登录与 PM 中心
 * 相关的导出:`EXTERNAL_LOGIN_FLAG` / `EXTERNAL_LOGIN_DEEPLINK_PATH` /
 * `EXTERNAL_LOGIN_TIMEOUT_MS` / `getExternalLoginUrl` /
 * `PM_CENTER_BASE_URL` / `TASK_CENTER_*` / `buildTaskCenterListUrl`。
 *
 * 注意 `KNOWLEDGE_BASE_*` 路径常量与 `EXTERNAL_LOGIN_URL_BASE` 都不是登录流程
 * 的产物 —— 前者是 AIPaaS 前端的 hash 路由，后者只是承载这些路由的站点前缀，
 * 所以「外链跳转」和「SSO 登录」共用一个 base 常量，裁剪时按 URL 用途而不是按
 * 文件归属切。
 */

import { getShellWindow } from './ipc';

/**
 * shell 的 `FLAVOR` 常量定义在 `packages/desktop/src/common/config/flavor.ts`，
 * 是一个**构建期常量**（`'public' | 'enterprise'`），preload 的 contextBridge
 * 从来没有把它挂到 window 上。
 *
 * 微应用不能 `import { FLAVOR } from '@/common/config/flavor'`：qiankun 沙箱是
 * 独立打包的，静态 import shell 模块等于把构建常量复制一份，两边一旦不一致就
 * 会出现「URL 选错分支」这种极难排查的问题。所以这里改成**运行时从真实 window
 * 读 `__FLAVOR__`**，并保留一个与当前 shell 构建一致的本地兜底值。
 *
 * 两处要保持同步：
 *   1. shell 侧 `expose-ipc-bridge.ts`（或 preload）增加
 *      `window.__FLAVOR__ = FLAVOR`；
 *   2. 下面的 `FALLBACK_FLAVOR` —— 目前 shell 的 `FLAVOR` 是 `'public'`。
 *
 * shell 未暴露该全局时退回 `'public'`，URL 分支与 shell 当前构建完全一致。
 */
type Flavor = 'public' | 'enterprise';

const FALLBACK_FLAVOR: Flavor = 'public';

function resolveFlavor(): Flavor {
  try {
    const flavor = (getShellWindow() as { __FLAVOR__?: unknown } | undefined)?.__FLAVOR__;
    if (flavor === 'public' || flavor === 'enterprise') return flavor;
  } catch {
    // 读不到就退回本地兜底值（上方已说明来源与同步点）
  }
  return FALLBACK_FLAVOR;
}

/** AIPaaS 后端服务的基础地址。
 *  多个业务模块（登录、注销、共享知识库等）共享此前缀，集中改动便于切换环境。
 *
 *  由 flavor 决定取值：enterprise 使用生产/预发域名，public 使用公网域名。
 *  修改集中在此处，调用方无需关心当前 flavor。
 */
export const AIPAAS_BASE_URL =
  resolveFlavor() === 'enterprise'
    ? 'http://devops.badousoft.com/aipaas-service'
    : 'https://devops.badousoft.com/aipublic-platform';
// : 'http://localhost:8081';

/** External login page URL base. The system browser loads this URL during
 *  the external login flow. `aipaas-front` reads the `from` query flag and
 *  redirects to the deep link below on SSO success.
 *
 *  enterprise flavor 使用 `https://devops.badousoft.com/aipaas-front/`；
 *  public flavor 指向本地 aipaas-front，默认 `http://localhost:8000`。
 */
export const EXTERNAL_LOGIN_URL_BASE =
  resolveFlavor() === 'enterprise'
    ? 'https://devops.badousoft.com/aipaas-front/'
    : 'https://devops.badousoft.com/aipaas-public/';
//: 'http://localhost:8910/';

/** Hash-route prefix for the external "new knowledge base" page. The
 *  trailing `add` segment is the create-page route defined by the vendor. */
const KNOWLEDGE_BASE_CREATE_PATH = '/#/module/tree/edit/ai_knowledge_user/add';
/** Hash-route prefix for the external "edit existing knowledge base" page.
 *  The base id is appended as a path segment after this prefix. */
const KNOWLEDGE_BASE_EDIT_PATH = '/#/module/tree/edit/ai_knowledge_user';
/** Hash-route prefix for the external "view" page (used for shared bases).
 *  The base id is appended as a path segment after this prefix. */
const KNOWLEDGE_BASE_VIEW_PATH = '/#/module/view/view/ai_knowledge_user';
const KNOWLEDGE_BASE_CREATE_PARENT_NAME = '知识库目录';
const KNOWLEDGE_BASE_CREATE_PARENT_ID = 'ROOT';

function encodeQueryParam(value: string): string {
  return encodeURIComponent(encodeURIComponent(JSON.stringify(JSON.parse(value))));
}

function encodeRawQueryParam(rawJson: string): string {
  return encodeURIComponent(encodeURIComponent(rawJson));
}

/** Build the external URL for creating a personal knowledge base.
 *  Mirrors the query shape used by the vendor's create page; values are
 *  double-encoded JSON so the receiving app can decode them once and parse. */
export function getKnowledgeBaseCreateUrl(): string {
  return buildKnowledgeBaseEditUrl(null);
}

/** Build the external URL for editing an existing personal knowledge base.
 *  The vendor route embeds the base id in the path segment; query params
 *  mirror the create page so the parent-node context is preserved. */
export function getKnowledgeBaseEditUrl(id: string): string {
  return buildKnowledgeBaseEditUrl(id);
}

/** Build the external URL for viewing a knowledge base (used for shared
 *  bases). Unlike edit/create, the view page does not need parent-tree
 *  query params — the base resolves on its own. */
export function getKnowledgeBaseViewUrl(id: string): string {
  return `${EXTERNAL_LOGIN_URL_BASE.replace(/\/$/, '')}${KNOWLEDGE_BASE_VIEW_PATH}/${id}`;
}

function buildKnowledgeBaseEditUrl(id: string | null): string {
  const addFormData = JSON.stringify({
    parentId: KNOWLEDGE_BASE_CREATE_PARENT_ID,
    parentName: KNOWLEDGE_BASE_CREATE_PARENT_NAME,
  });
  const backParams = '{}';
  const currentTreeNodeData = JSON.stringify({
    code: null,
    treeLevel: 0,
    name: KNOWLEDGE_BASE_CREATE_PARENT_NAME,
    type: null,
    id: KNOWLEDGE_BASE_CREATE_PARENT_ID,
    pid: null,
    children: null,
    hasChild: false,
    priority: 0,
    isexpand: true,
  });
  const params = [
    `addFormData=${encodeQueryParam(addFormData)}`,
    `backParams=${encodeRawQueryParam(backParams)}`,
    `currentTreeNodeData=${encodeRawQueryParam(currentTreeNodeData)}`,
  ].join('&');
  const path = id ? `${KNOWLEDGE_BASE_EDIT_PATH}/${id}` : KNOWLEDGE_BASE_CREATE_PATH;
  return `${EXTERNAL_LOGIN_URL_BASE.replace(/\/$/, '')}${path}?${params}`;
}
