/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库列表的只读读取,当前唯一消费方是 `useKbMentionSearch`(kb-chat 的
 * `@` 提及菜单)。原实现是 `hooks/knowledge-base/useKnowledgeBaseList.ts`,
 * 知识库页面迁到 qiankun 子应用后只剩这一个消费方,顺势搬到这里与消费方同住。
 *
 * 为什么只声明三个字段,而不是复用完整的 `KnowledgeBaseItem`
 * ==========================================================
 * `KnowledgeBaseItem` 现在是「AIPaaS 后端 ↔ 两个消费方」的契约,而两个消费方
 * 住在**不同的 JS realm**:知识库页面在 qiankun 子应用里(qiankun 沙箱会把
 * 模块打包一份独立的实例,import shell 路径拿不到东西),这里在 shell 里。
 * 共用一份类型只能放到两边都能 import 的位置,代价是 shell 侧为了三个字段
 * 拖进一整个子应用的类型。
 *
 * 与其为了消除这点重复去共享类型,不如让每边**显式声明自己消费的切片**:
 * 这里只要 id / name / isShared(拼 `@` 提及 token 用),多出来的字段描述、
 * 图标、agent 绑定等一律不关心 —— 少声明即少一处会漂移的地方。
 * 若后端给 `id` / `name` / `isShared` 改了语义,两边都会在编译期或运行期
 * 立刻暴露,这正是我们想要的。
 */
import { AIPAAS_BASE_URL } from '@/renderer/api';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { useCallback, useEffect, useState } from 'react';

/** 后端共享知识库原始记录结构。字段命名以 listJSON.do 响应为准。 */
type SharedKnowledgeBaseRemoteRow = {
  id: string;
  name: string;
  flgPublicDesc?: string;
  statusDesc?: string;
  storageBase?: number;
  storageBaseDesc?: string;
  queryCount?: number | null;
  fileCount?: number | null;
  flgPublic?: number;
  capacity?: number | null;
  createTime?: string;
  scope?: string | null;
  relatedIndustry?: string | null;
  rowCount?: number | null;
  shareObject?: string;
  status?: number;
};

/** 后端个人知识库原始记录结构。与共享列表共用同一字段子集。 */
type PersonalKnowledgeBaseRemoteRow = {
  id: string;
  name: string;
  flgPublicDesc?: string;
  statusDesc?: string;
  storageBaseDesc?: string;
  fileCount?: number | null;
  createTime?: string;
  shareObject?: string;
};

type ListEnvelope<TRow> = {
  Total?: number;
  Rows?: TRow[];
};

/** `@` 提及菜单消费的最小字段集(见文件头注释)。 */
export type KnowledgeBaseReference = {
  id: string;
  name: string;
  isShared: boolean;
};

const mapSharedRemoteRowToItem = (row: SharedKnowledgeBaseRemoteRow): KnowledgeBaseReference => ({
  id: row.id,
  name: row.name,
  isShared: true,
});

const mapPersonalRemoteRowToItem = (row: PersonalKnowledgeBaseRemoteRow): KnowledgeBaseReference => ({
  id: row.id,
  name: row.name,
  isShared: false,
});

/**
 * Manages the knowledge base list: loading personal + shared entries from the
 * AIPaaS backend. Both lists are fetched in parallel on mount and on
 * `loadKnowledgeBases()`.
 */
export const useKnowledgeBaseList = () => {
  const { user, notifyTokenExpired } = useAuth();
  const token = user?.token;

  const [personalItems, setPersonalItems] = useState<KnowledgeBaseReference[]>([]);
  const [sharedItems, setSharedItems] = useState<KnowledgeBaseReference[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);

  const fetchList = async <TRow>(
    authToken: string,
    url: string,
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    setItems: (items: KnowledgeBaseReference[]) => void,
    map: (row: TRow) => KnowledgeBaseReference
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
        notifyTokenExpired('knowledge-base');
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      if (text.trim() === '') {
        notifyTokenExpired('knowledge-base');
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

  return {
    personalItems,
    sharedItems,
    personalLoading,
    sharedLoading,
    personalError,
    sharedError,
    loadKnowledgeBases,
    loadPersonalKnowledgeBases,
    loadSharedKnowledgeBases,
  };
};
