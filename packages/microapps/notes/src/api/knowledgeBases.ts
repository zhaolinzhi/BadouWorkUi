/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库列表接口 —— 与 knowledge-base 微应用**同一套** AIPaaS `listJSON.do`。
 *
 * 为什么在这里再写一份
 * ===================
 * 知识库微应用(`packages/microapps/knowledge-base`)里已经有同样的请求,但两个
 * 微应用之间没有共享的业务包(共享层 `@aionui/microapp-shared` 只管运行时,不管
 * 业务接口),所以这里按同样的形状再写一份:
 *   - 个人知识库:`/project/aiknowledge/aiknowledgebaselist/listJSON.do?mdCode=view_knowledge_user`
 *   - 共享知识库:`/jdbc/common/basecommonlist/listJSON.do?mdCode=share_knowledge_base`
 * 都是 `GET` + `Token` 头 + `credentials: 'include'`,响应是 `{ Total, Rows }` 信封,
 * 字段映射也照抄知识库微应用那一套(`name` / `flgPublicDesc` / `storageBaseDesc` /
 * `fileCount` / `shareObject`)。
 *
 * 分页
 * ====
 * 平台翻页的参数是 `pageNo` / `perPageSize`(任务中心页对同一个 `listJSON.do`
 * 就是这么翻的),这里把它们挂在 query 上。
 *
 * 后端**可能不认**这两个参数 —— 这两个 mdCode 之前都是一次性取全量的。所以上层
 * 不靠翻页参数判断「还有没有下一页」,而是靠:
 *   - 有 `Total` 时:已加载条数 < 总数;
 *   - 没有 `Total` 时:这一页是不是满页;
 *   - 追加时按 id 去重 —— 后端不认分页参数时,追加回来的就是同一批数据,去重后
 *     不增长,「加载更多」自然消失。
 * 这样两种后端行为下界面都是对的。
 */
import { emitAuthExpired } from '@aionui/microapp-shared';

/** 知识库归属:个人 / 共享。 */
export type KnowledgeBaseScope = 'personal' | 'shared';

/** 下拉里的一项知识库(菜单只用到这几个字段)。 */
export type KnowledgeBaseOption = {
  id: string;
  name: string;
  scope: KnowledgeBaseScope;
  /** 共享方(个人知识库没有这个字段)。 */
  owner?: string;
  /** 简介 —— 后端给的是「公开范围」或「存储位」描述。 */
  description?: string;
  /** 文档数。 */
  documentCount?: number;
};

/** 一页知识库。`total` 是服务端给的总数,没有这个字段时为 null。 */
export type KnowledgeBasePage = {
  items: KnowledgeBaseOption[];
  total: number | null;
};

/** 每页条数 —— 与任务中心页一致。 */
export const KNOWLEDGE_BASE_PAGE_SIZE = 20;

/** 后端原始记录(两个列表共用同一套字段子集)。 */
type KnowledgeBaseRow = {
  id: string;
  name: string;
  flgPublicDesc?: string;
  storageBaseDesc?: string;
  fileCount?: number | null;
  createTime?: string;
  shareObject?: string;
};

type ListEnvelope<TRow> = {
  Total?: number;
  Rows?: TRow[];
};

/**
 * AIPaaS 后端服务的基础地址。
 *
 * 取值与 shell(`packages/desktop/src/renderer/api/config.ts`)一致:enterprise 用
 * `aipaas-service`,public 用 `aipublic-platform`。
 *
 * flavor 是**构建期常量**,preload 没有把它挂到 window 上;shell 在
 * `expose-ipc-bridge.ts` 里补挂了 `window.__FLAVOR__`,这里运行时读它,读不到
 * 就退回与当前 shell 构建一致的本地兜底值('public')。
 */
type Flavor = 'public' | 'enterprise';

const FALLBACK_FLAVOR: Flavor = 'public';

/**
 * 取到「真正的」global window(绕过 qiankun Proxy)。
 * 间接 eval 是唯一在 global scope 执行的 eval 形式,qiankun 拦不住。
 */
function getShellWindow(): (Window & typeof globalThis) | undefined {
  try {
    // eslint-disable-next-line no-eval
    const real = (0, eval)('window') as Window & typeof globalThis;
    return real ?? (typeof window !== 'undefined' ? window : undefined);
  } catch {
    return typeof window !== 'undefined' ? window : undefined;
  }
}

function resolveFlavor(): Flavor {
  try {
    const flavor = (getShellWindow() as { __FLAVOR__?: unknown } | undefined)?.__FLAVOR__;
    if (flavor === 'public' || flavor === 'enterprise') return flavor;
  } catch {
    // 读不到就退回本地兜底值(上方已说明来源与同步点)
  }
  return FALLBACK_FLAVOR;
}

export const AIPAAS_BASE_URL =
  resolveFlavor() === 'enterprise'
    ? 'https://devops.badousoft.com/aipaas-service'
    : 'https://devops.badousoft.com/aipublic-platform';

/** 两个列表各自的查询路径(mdCode 与知识库微应用一致)。 */
const LIST_PATHS: Record<KnowledgeBaseScope, string> = {
  personal: '/project/aiknowledge/aiknowledgebaselist/listJSON.do?mdCode=view_knowledge_user',
  shared: '/jdbc/common/basecommonlist/listJSON.do?mdCode=share_knowledge_base',
};

/** 拼出某一页的列表地址(分页参数挂在 query 上)。 */
export function buildKnowledgeBaseListUrl(scope: KnowledgeBaseScope, pageNo: number, perPageSize: number): string {
  const search = new URLSearchParams({
    pageNo: String(pageNo),
    perPageSize: String(perPageSize),
  });
  return `${AIPAAS_BASE_URL}${LIST_PATHS[scope]}&${search.toString()}`;
}

const mapRow = (row: KnowledgeBaseRow, scope: KnowledgeBaseScope): KnowledgeBaseOption => ({
  id: row.id,
  name: row.name,
  scope,
  owner: row.shareObject,
  description: row.flgPublicDesc ?? row.storageBaseDesc ?? '',
  documentCount: typeof row.fileCount === 'number' ? row.fileCount : undefined,
});

/**
 * 取一页知识库。
 *
 * 401 → `emitAuthExpired` 回传给 shell 统一登出(与知识库微应用同一套出口)。
 * 空 body 按「没有数据」处理,不当成登录过期 —— 任务中心页的注释里明确写过:
 * 鉴权通过但查不到数据时平台会返回 200 + 空 body,拿它踢人下线是误伤。
 */
export async function fetchKnowledgeBasePage(params: {
  scope: KnowledgeBaseScope;
  token: string;
  pageNo: number;
  perPageSize?: number;
}): Promise<KnowledgeBasePage> {
  const { scope, token, pageNo, perPageSize = KNOWLEDGE_BASE_PAGE_SIZE } = params;
  const response = await fetch(buildKnowledgeBaseListUrl(scope, pageNo, perPageSize), {
    method: 'GET',
    headers: {
      Token: token,
    },
    credentials: 'include',
  });

  if (response.status === 401) {
    emitAuthExpired('notes');
    return { items: [], total: null };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();
  if (text.trim() === '') {
    return { items: [], total: 0 };
  }

  let data: ListEnvelope<KnowledgeBaseRow>;
  try {
    data = JSON.parse(text) as ListEnvelope<KnowledgeBaseRow>;
  } catch (parseError) {
    throw new Error(parseError instanceof Error ? parseError.message : 'Invalid JSON response', { cause: parseError });
  }

  const rows = Array.isArray(data?.Rows) ? data.Rows : [];
  const total = typeof data?.Total === 'number' ? data.Total : null;
  return { items: rows.map((row) => mapRow(row, scope)), total };
}
