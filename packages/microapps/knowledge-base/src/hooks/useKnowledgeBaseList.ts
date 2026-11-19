/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem } from '../types';
import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useEffect, useState } from 'react';
import { useAppRuntime } from '../AppContext';

/**
 * 后端共享知识库原始记录结构。
 *
 * 字段命名以后端 listJSON.do 响应为准；后续若新增字段可在此扩展。
 * 实测响应示例：
 * ```json
 * {
 *   "flgShare": "1", "flgPublicDesc": "系统管理员", "statusDesc": "启用",
 *   "storageBase": 10, "queryCount": null, "fileCount": "2", "flgPublic": 0,
 *   "capacity": null, "createTime": "2026-07-27", "scope": null,
 *   "name": "花都效能监测系统", "relatedIndustry": null, "id": "b233…",
 *   "rowCount": null, "storageBaseDesc": "向量库", "shareObject": "10",
 *   "status": 1
 * }
 * ```
 */
type SharedKnowledgeBaseRemoteRow = {
  id: string;
  name: string;
  /** 创建人 / 负责人（人名），如「系统管理员」。 */
  flgPublicDesc?: string;
  statusDesc?: string;
  storageBase?: number;
  /** 存储类型描述，如「向量库」。 */
  storageBaseDesc?: string;
  queryCount?: number | null;
  /** 文档数 —— **接口给的是字符串**（`"2"`），也有给数字的。 */
  fileCount?: string | number | null;
  flgPublic?: number;
  capacity?: number | null;
  createTime?: string;
  scope?: string | null;
  relatedIndustry?: string | null;
  rowCount?: number | null;
  /** 共享对象 id（"10" 这样的码，不可读）。 */
  shareObject?: string;
  /** 是否共享（"1"）。列表分个人/共享两个接口，可见范围以接口为准。 */
  flgShare?: string;
  status?: number;
};

/**
 * 后端个人知识库原始记录结构。
 * 与共享列表共用同一字段子集；若服务端字段差异较大，后续按需扩展。
 */
type PersonalKnowledgeBaseRemoteRow = {
  id: string;
  name: string;
  /** 创建人 / 负责人（人名），如「系统管理员」。 */
  flgPublicDesc?: string;
  statusDesc?: string;
  storageBaseDesc?: string;
  /** 文档数 —— **接口给的是字符串**（`"2"`），也有给数字的。 */
  fileCount?: string | number | null;
  createTime?: string;
  shareObject?: string;
  flgShare?: string;
};

type ListEnvelope<TRow> = {
  Total?: number;
  Rows?: TRow[];
};

/**
 * 文档数 —— 接口给的是字符串（`"2"`）。
 *
 * 早先按 `typeof value === 'number'` 判断，数字字符串全被判成「没这个字段」，
 * 于是卡片上的「N 份文档」恒为 0。
 */
const parseCount = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * 卡片上那行说明文字。
 *
 * 后端没有真正的「描述」字段，只能拿现有的两个凑：`storageBaseDesc`
 * （存储类型，如「向量库」）说的是知识库本身，`flgPublicDesc`
 * （创建人，如「系统管理员」）说的是人 —— 前者优先。
 */
const resolveDescription = (row: { storageBaseDesc?: string; flgPublicDesc?: string }): string =>
  row.storageBaseDesc ?? row.flgPublicDesc ?? '';

const mapSharedRemoteRowToItem = (row: SharedKnowledgeBaseRemoteRow): KnowledgeBaseItem => ({
  id: row.id,
  name: row.name,
  isShared: true,
  source: 'builtin',
  description: resolveDescription(row),
  // 拥有者用人名；`shareObject` 是 id 码（"10"），对人不可读。
  owner: row.flgPublicDesc ?? row.shareObject,
  documentCount: parseCount(row.fileCount),
  createdAt: row.createTime,
  updatedAt: row.createTime,
});

const mapPersonalRemoteRowToItem = (row: PersonalKnowledgeBaseRemoteRow): KnowledgeBaseItem => ({
  id: row.id,
  name: row.name,
  isShared: false,
  source: 'user',
  description: resolveDescription(row),
  // 拥有者用人名；`shareObject` 是 id 码（"10"），对人不可读。
  owner: row.flgPublicDesc ?? row.shareObject,
  documentCount: parseCount(row.fileCount),
  createdAt: row.createTime,
  updatedAt: row.createTime,
});

/**
 * Manages the knowledge base list: loading personal + shared entries from the
 * AIPaaS backend, tracking active selection. Both lists are fetched in
 * parallel on mount and on `loadKnowledgeBases()`.
 *
 * token 从 `props.token` 来(shell 在 mount 时快照),不是 shell 的 `useAuth()`
 * —— 子应用在 qiankun 沙箱里够不到那个 Provider。401 走 `emitAuthExpired`,
 * 由 shell 统一提示 + 登出。
 */
export const useKnowledgeBaseList = () => {
  const { token } = useAppRuntime();

  const [personalItems, setPersonalItems] = useState<KnowledgeBaseItem[]>([]);
  const [sharedItems, setSharedItems] = useState<KnowledgeBaseItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);
  // 「已完成首次加载」标记 —— 详情页靠它区分「列表还没加载完」与「库已被删除」。
  const [personalLoaded, setPersonalLoaded] = useState(false);
  const [sharedLoaded, setSharedLoaded] = useState(false);
  const [activeKnowledgeBaseId, setActiveKnowledgeBaseId] = useState<string | null>(null);

  const fetchList = async <TRow>(
    authToken: string,
    url: string,
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setItems: (items: KnowledgeBaseItem[]) => void,
    setLoaded: (loaded: boolean) => void,
    map: (row: TRow) => KnowledgeBaseItem
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Token: authToken,
        },
        credentials: 'include',
      });
      if (response.status === 401) {
        emitAuthExpired('knowledge-base');
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      if (text.trim() === '') {
        emitAuthExpired('knowledge-base');
        return;
      }
      let data: ListEnvelope<TRow>;
      try {
        data = JSON.parse(text) as ListEnvelope<TRow>;
      } catch (parseError) {
        throw new Error(parseError instanceof Error ? parseError.message : 'Invalid JSON response');
      }
      const rows = Array.isArray(data?.Rows) ? data.Rows : [];
      setItems(rows.map(map));
      setLoaded(true);
    } catch (error) {
      console.error('[useKnowledgeBaseList] failed to load knowledge bases:', error);
      setError((error as Error).message || 'unknown error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSharedKnowledgeBases = useCallback(async (authToken: string) => {
    await fetchList<SharedKnowledgeBaseRemoteRow>(
      authToken,
      `${AIPAAS_BASE_URL}/jdbc/common/basecommonlist/listJSON.do?mdCode=share_knowledge_base`,
      setSharedLoading,
      setSharedError,
      setSharedItems,
      setSharedLoaded,
      mapSharedRemoteRowToItem
    );
  }, []);

  const loadPersonalKnowledgeBases = useCallback(async (authToken: string) => {
    await fetchList<PersonalKnowledgeBaseRemoteRow>(
      authToken,
      `${AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebaselist/listJSON.do?mdCode=view_knowledge_user`,
      setPersonalLoading,
      setPersonalError,
      setPersonalItems,
      setPersonalLoaded,
      mapPersonalRemoteRowToItem
    );
  }, []);

  const loadKnowledgeBases = useCallback(async () => {
    if (!token) return;
    await Promise.all([loadPersonalKnowledgeBases(token), loadSharedKnowledgeBases(token)]);
  }, [loadPersonalKnowledgeBases, loadSharedKnowledgeBases, token]);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const allItems = [...personalItems, ...sharedItems];
  const activeKnowledgeBase = allItems.find((item) => item.id === activeKnowledgeBaseId) ?? null;

  return {
    personalItems,
    setPersonalItems,
    sharedItems,
    setSharedItems,
    personalLoading,
    sharedLoading,
    personalError,
    sharedError,
    personalLoaded,
    sharedLoaded,
    activeKnowledgeBaseId,
    setActiveKnowledgeBaseId,
    activeKnowledgeBase,
    loadKnowledgeBases,
    loadPersonalKnowledgeBases,
    loadSharedKnowledgeBases,
  };
};
