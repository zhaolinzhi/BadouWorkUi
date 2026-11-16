/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 「添加到知识库」下拉里的知识库列表。
 *
 * 数据来源
 * ========
 * 与知识库微应用同一套 AIPaaS `listJSON.do`(见 `api/knowledgeBases.ts`):
 * 个人知识库 + 共享知识库两个列表。
 *
 * 加载时机
 * ========
 * **懒加载**:菜单打开时才拉第一页(`ensureLoaded`),之后每次打开菜单都直接用
 * 缓存的列表 —— 笔记列表里每一行都包着这个右键菜单,要是每行各拉一次,打开一次
 * 菜单就是 N 个请求。
 *
 * 分页
 * ====
 * 「加载更多」按需拉下一页。两个列表各有各的页码,一次「加载更多」把**还有下一页
 * 的那些列表**各拉一页(个人库通常没那么多,真正需要翻页的是共享库)。
 *
 * 「还有没有下一页」不只看翻页参数:后端可能不认 `pageNo`/`perPageSize`,那它
 * 每次都返回同一批数据 —— 追加时按 id 去重,一条新的都没有就说明没在翻页,这时
 * 「加载更多」自己消失。详见 `api/knowledgeBases.ts` 顶部的说明。
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../AppContext';
import {
  KNOWLEDGE_BASE_PAGE_SIZE,
  fetchKnowledgeBasePage,
  type KnowledgeBaseOption,
  type KnowledgeBaseScope,
} from '../api/knowledgeBases';
import { createStandaloneMockKnowledgeBasePage, isStandaloneMockActive } from '../__qiankun__/standaloneMock';

/** 下拉菜单用的知识库列表状态。 */
export type KnowledgeBaseMenuState = {
  personalItems: KnowledgeBaseOption[];
  sharedItems: KnowledgeBaseOption[];
  loading: boolean;
  error: string | null;
  /** 还有没有下一页(任一列表还有就还有)。 */
  hasMore: boolean;
  /** 拉下一页。 */
  loadMore: () => void;
  /** 菜单打开时调一次:没拉过就拉第一页。 */
  ensureLoaded: () => void;
};

/** 单个列表(个人 / 共享)的分页状态。 */
type ScopeState = {
  items: KnowledgeBaseOption[];
  /** 服务端给的总数;没有这个字段时为 null。 */
  total: number | null;
  /** 已经加载到第几页。 */
  pageNo: number;
  hasMore: boolean;
};

const EMPTY_SCOPE: ScopeState = { items: [], total: null, pageNo: 0, hasMore: false };

/** 按 id 去重,保留先出现的那个。 */
const dedupeById = (items: KnowledgeBaseOption[]): KnowledgeBaseOption[] => {
  const seen = new Set<string>();
  const result: KnowledgeBaseOption[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
};

/**
 * 还有没有下一页。
 *
 * - 有总数:比总数少就还有;
 * - 没总数:这一页满页才可能还有 —— 追加时一条新的都没有,说明后端没在翻页
 *   (每次都返回同一批),这时别让用户白点。
 */
const computeHasMore = (params: {
  merged: KnowledgeBaseOption[];
  total: number | null;
  pageSize: number;
  added: number;
  perPageSize: number;
}): boolean => {
  const { merged, total, pageSize, added, perPageSize } = params;
  if (total !== null) return merged.length < total;
  if (pageSize < perPageSize) return false;
  return added > 0;
};

export function useKnowledgeBaseOptions(): KnowledgeBaseMenuState {
  const ctx = useAppContext();
  const token = ctx.token;

  const [personal, setPersonal] = useState<ScopeState>(EMPTY_SCOPE);
  const [shared, setShared] = useState<ScopeState>(EMPTY_SCOPE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 第一页拉过了没有 —— 菜单每次打开都调 `ensureLoaded`,靠它保证只拉一次。 */
  const firstPageLoadedRef = useRef(false);
  /** 正在请求中 —— 防止连点「加载更多」触发并发请求。 */
  const inFlightRef = useRef(false);

  const loadPage = useCallback(
    async (scope: KnowledgeBaseScope, pageNo: number, mode: 'replace' | 'append') => {
      const page = isStandaloneMockActive()
        ? createStandaloneMockKnowledgeBasePage({ scope, pageNo, perPageSize: KNOWLEDGE_BASE_PAGE_SIZE })
        : await fetchKnowledgeBasePage({ scope, token, pageNo, perPageSize: KNOWLEDGE_BASE_PAGE_SIZE });

      const setter = scope === 'personal' ? setPersonal : setShared;
      setter((prev) => {
        const merged = mode === 'replace' ? dedupeById(page.items) : dedupeById([...prev.items, ...page.items]);
        const total = page.total ?? prev.total;
        return {
          items: merged,
          total,
          pageNo,
          hasMore: computeHasMore({
            merged,
            total,
            pageSize: page.items.length,
            added: merged.length - prev.items.length,
            perPageSize: KNOWLEDGE_BASE_PAGE_SIZE,
          }),
        };
      });
    },
    [token]
  );

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPage('personal', 1, 'replace'), loadPage('shared', 1, 'replace')]);
    } catch (e) {
      console.error('[useKnowledgeBaseOptions] failed to load knowledge bases', e);
      setError(e instanceof Error ? e.message : String(e));
      // 拉失败了下次打开菜单再试一次。
      firstPageLoadedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  const ensureLoaded = useCallback(() => {
    if (firstPageLoadedRef.current || inFlightRef.current) return;
    firstPageLoadedRef.current = true;
    inFlightRef.current = true;
    void loadFirstPage().finally(() => {
      inFlightRef.current = false;
    });
  }, [loadFirstPage]);

  const loadMore = useCallback(() => {
    if (!firstPageLoadedRef.current || inFlightRef.current) return;
    const tasks: Promise<void>[] = [];
    if (personal.hasMore) tasks.push(loadPage('personal', personal.pageNo + 1, 'append'));
    if (shared.hasMore) tasks.push(loadPage('shared', shared.pageNo + 1, 'append'));
    if (tasks.length === 0) return;

    inFlightRef.current = true;
    setLoading(true);
    void Promise.all(tasks)
      .catch((e) => {
        console.error('[useKnowledgeBaseOptions] failed to load more knowledge bases', e);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoading(false);
      });
  }, [loadPage, personal.hasMore, personal.pageNo, shared.hasMore, shared.pageNo]);

  return useMemo(
    () => ({
      personalItems: personal.items,
      sharedItems: shared.items,
      loading,
      error,
      hasMore: personal.hasMore || shared.hasMore,
      loadMore,
      ensureLoaded,
    }),
    [personal.items, shared.items, loading, error, personal.hasMore, shared.hasMore, loadMore, ensureLoaded]
  );
}
