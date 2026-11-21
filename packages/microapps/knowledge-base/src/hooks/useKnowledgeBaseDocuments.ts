/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库文档列表（产品设计资料页）的数据层。
 *
 * 接口：`POST {AIPAAS_BASE_URL}/jdbc/common/basecommonlist/listJSON.do?mdCode=view_knowledge_relevancy`
 *   - `defaultSearchParam` —— 固定带 `knowledgeBaseId` 的 exact-match 过滤
 *   - `searchParam`        —— 文件名搜索（空数组 = 不搜）
 *   - `pageNo` / `perPageSize` —— 分页
 * 响应：`{ Total, Rows }`
 *
 * 与任务中心（`packages/desktop/src/renderer/pages/task-center/useTaskCenterList.ts`）
 * 是同一套后端家族，请求体形态保持一致。
 */

import type { KnowledgeBaseDocument } from '../types';
import type { KnowledgeBaseDocumentListEnvelope } from '../utils/knowledgeBaseUtils';
import { KNOWLEDGE_DOCUMENT_LIST_URL, mapKnowledgeDocumentRow } from '../utils/knowledgeBaseUtils';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppRuntime } from '../AppContext';

const DOCUMENT_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

/** 排序方向 —— 接口的 `sortorder` 取值。 */
export type DocumentSortOrder = 'asc' | 'desc';

/**
 * 排序字段 —— 接口的 `sortname`。
 *
 * 设计稿的按钮文案写的是「按更新时间排序」，但列表接口的排序字段给的是
 * `createTime`（创建时间），所以这里按接口来，按钮文案也跟实际行为对齐。
 */
const SORT_FIELD = 'createTime';

/**
 * 拉某个知识库下的文档列表。
 *
 * @param knowledgeBaseId 知识库 id；为空时不发请求。
 */
export const useKnowledgeBaseDocuments = (knowledgeBaseId: string | undefined) => {
  const { token } = useAppRuntime();

  const [documents, setDocuments] = useState<KnowledgeBaseDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  /** 输入框里的即时值。 */
  const [keyword, setKeyword] = useState('');
  /** 真正落到请求上的搜索词（防抖后的值）。 */
  const [activeKeyword, setActiveKeyword] = useState('');
  /** 排序方向（随请求发给后端）。 */
  const [sortOrder, setSortOrder] = useState<DocumentSortOrder>('desc');
  /** 上一次已处理的输入值 —— 用来区分「首次挂载」与「用户改了搜索词」。 */
  const prevKeyword = useRef('');
  /**
   * 当前排序方向的「随时可读」副本。
   *
   * 搜索防抖那个 effect 要读**最新**的排序，但不能把 `sortOrder` 放进它的依赖 ——
   * 否则排序一变就会顺带重跑一次带 300ms 防抖的搜索请求。用 ref 绕开这个耦合。
   */
  const sortOrderRef = useRef<DocumentSortOrder>('desc');

  /**
   * 请求序号。每次发请求自增；响应回来时序号对不上，说明已经有更新的请求了 ——
   * 这条响应直接丢掉，避免「先发的慢响应」覆盖「后发的快响应」。
   */
  const requestSeq = useRef(0);

  /**
   * 文档总数的「随时可读」副本 —— 轮询刷新靠它判断「新文档出现了没有」。
   */
  const totalRef = useRef(0);

  /** 轮询刷新的定时器（组件卸载时要清掉）。 */
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 拉取一页数据。
   *
   * @returns 这次请求是否「成功落地」（数据或空列表已应用）。无 token / 无
   * knowledgeBaseId / 竞态丢弃 / 401 / 请求或解析失败均返回 false —— 调用方
   * 据此决定要不要推进页码，避免请求失败后永久跳过一页。
   */
  const fetchPage = useCallback(
    async (
      page: number,
      keywordValue: string,
      sort: DocumentSortOrder,
      mode: 'replace' | 'append'
    ): Promise<boolean> => {
      if (!token || !knowledgeBaseId) return false;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const defaultSearchParam = [{ name: 'knowledgeBaseId', value: knowledgeBaseId, type: 'exact-match' }];
        const trimmed = keywordValue.trim();
        const searchParam = trimmed ? [{ name: 'name', value: trimmed, type: 'text-query', tagName: '' }] : [];
        const body = new URLSearchParams({
          defaultSearchParam: JSON.stringify(defaultSearchParam),
          searchParam: JSON.stringify(searchParam),
          pageNo: String(page),
          perPageSize: String(DOCUMENT_PAGE_SIZE),
          sortorder: sort,
          sortname: SORT_FIELD,
        }).toString();

        const response = await fetch(KNOWLEDGE_DOCUMENT_LIST_URL, {
          method: 'POST',
          headers: {
            Token: token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          credentials: 'include',
          body,
        });

        if (seq !== requestSeq.current) return false;

        // 过期请求的 401 同样在上一行被丢弃、不触发登出 —— 会话真过期时，
        // 当前生效的请求必然也会拿到 401，那时才登出；旧请求 401 而新请求
        // 成功只可能是 token 轮换，丢弃反而正确。
        if (response.status === 401) {
          emitAuthExpired('knowledge-base');
          return false;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        if (seq !== requestSeq.current) return false;

        /*
         * 空 body 按「没有数据」处理，不踢登录。
         *
         * 与同目录的兄弟 hook `useKnowledgeBaseList` 相反 —— 那个把空 body
         * 当成会话过期。这里选择不踢：打开一个空知识库不该把用户登出。
         * 真过期时后续任何请求都会 401，那时才登出。
         */
        if (text.trim() === '') {
          // append 模式下不清空 —— 已经加载的页不该因为这一页没数据而消失。
          if (mode === 'replace') {
            setDocuments([]);
            setTotal(0);
            totalRef.current = 0;
          }
          return true;
        }

        let data: KnowledgeBaseDocumentListEnvelope;
        try {
          data = JSON.parse(text) as KnowledgeBaseDocumentListEnvelope;
        } catch (parseError) {
          throw new Error(parseError instanceof Error ? parseError.message : 'Invalid JSON response', {
            cause: parseError,
          });
        }

        const rows = Array.isArray(data?.Rows) ? data.Rows : [];
        const mapped = rows.map(mapKnowledgeDocumentRow);
        setDocuments((prev) => (mode === 'append' ? [...prev, ...mapped] : mapped));
        const nextTotal = Number(data?.Total ?? 0);
        setTotal(nextTotal);
        // 轮询靠这个判断「文档出现了没有」。
        totalRef.current = nextTotal;
        return true;
      } catch (err) {
        if (seq !== requestSeq.current) return false;
        console.error('[useKnowledgeBaseDocuments] failed to load documents:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        if (mode === 'replace') {
          setDocuments([]);
          setTotal(0);
          totalRef.current = 0;
        }
        return false;
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [token, knowledgeBaseId]
  );

  // 搜索词防抖：停止输入 SEARCH_DEBOUNCE_MS 后才落到请求，并回到第 1 页。
  //
  // 声明顺序：必须在下面「换库重置」effect 之前。换库那一轮 commit 里，
  // 本 effect 先跑 —— 看到 prevKeyword 与 keyword 相同就直接返回，
  // 不会因为「重置把 keyword 清空」而多发一次请求。
  useEffect(() => {
    if (prevKeyword.current === keyword) return;
    prevKeyword.current = keyword;
    const timer = setTimeout(() => {
      const trimmed = keyword.trim();
      setActiveKeyword(trimmed);
      setPageNo(1);
      void fetchPage(1, trimmed, sortOrderRef.current, 'replace');
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword, fetchPage]);

  // 首次加载 / 换库：重置搜索、排序与页码，拉第 1 页。
  //
  // `fetchPage` 的依赖是 [token, knowledgeBaseId]，所以这个 effect 只在
  // 首次挂载与换库时重跑 —— 排序变化不会走到这里（排序自己发请求）。
  useEffect(() => {
    prevKeyword.current = '';
    setKeyword('');
    setActiveKeyword('');
    setSortOrder('desc');
    sortOrderRef.current = 'desc';
    setPageNo(1);
    void fetchPage(1, '', 'desc', 'replace');
  }, [fetchPage]);

  /** 切换排序方向（服务端排序）：重新拉第 1 页。 */
  const toggleSortOrder = useCallback(() => {
    const next = sortOrderRef.current === 'asc' ? 'desc' : 'asc';
    sortOrderRef.current = next;
    setSortOrder(next);
    setPageNo(1);
    void fetchPage(1, activeKeyword, next, 'replace');
  }, [activeKeyword, fetchPage]);

  /** 重新拉当前页（错误态的「重试」按钮用）。 */
  const reload = useCallback(() => {
    void fetchPage(pageNo, activeKeyword, sortOrderRef.current, pageNo === 1 ? 'replace' : 'append');
  }, [activeKeyword, fetchPage, pageNo]);

  /**
   * 回到第 1 页重拉（列表内容变了时用 —— 比如刚上传了文档）。
   *
   * 新上传的文档按创建时间倒序排在最前面，所以要回到第 1 页才看得见。
   */
  const refresh = useCallback(async () => {
    setPageNo(1);
    return fetchPage(1, activeKeyword, sortOrderRef.current, 'replace');
  }, [activeKeyword, fetchPage]);

  /*
   * 轮询刷新。
   *
   * 上传是**异步处理**的：上传接口返回时文档还没进列表（设计稿里的「文件处理
   * 队列」就是这段处理），要过一会儿才出现。所以上传成功后要连续刷新几次，
   * 直到总数变大为止 —— 只刷新一次的话，用户看到的还是「上传了但列表没动」。
   */
  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  /**
   * 连续刷新列表若干次（不看结果）。
   *
   * 用于「重新解析」这类**内容变了但总数没变**的场景 —— 后端在后台解析，
   * 行上的「N 条数据」过一会儿才更新，刷新一次看到的还是旧值。
   *
   * @param attempts    刷新几次。
   * @param intervalMs  两次刷新之间的间隔。
   */
  const pollRefresh = useCallback(
    async (attempts = 4, intervalMs = 2000) => {
      stopPolling();
      let remaining = attempts;
      const tick = async () => {
        await refresh();
        remaining -= 1;
        if (remaining <= 0) {
          pollTimer.current = null;
          return;
        }
        pollTimer.current = setTimeout(() => void tick(), intervalMs);
      };
      await tick();
    },
    [refresh, stopPolling]
  );

  /**
   * 连续刷新列表，直到文档总数变大（或次数用完）。
   *
   * @param attempts    最多刷新几次。
   * @param intervalMs  两次刷新之间的间隔。
   */
  const pollUntilTotalGrows = useCallback(
    async (attempts = 15, intervalMs = 2000) => {
      stopPolling();
      const baseline = totalRef.current;
      let remaining = attempts;
      const tick = async () => {
        await refresh();
        remaining -= 1;
        // 文档出现了就停 —— 别一直打扰后端。
        if (totalRef.current > baseline || remaining <= 0) {
          pollTimer.current = null;
          return;
        }
        pollTimer.current = setTimeout(() => void tick(), intervalMs);
      };
      await tick();
    },
    [refresh, stopPolling]
  );

  // 组件卸载时把轮询停掉，别让定时器在后台一直跑。
  useEffect(() => stopPolling, [stopPolling]);

  /** 加载下一页并追加。 */
  const loadMore = useCallback(async () => {
    if (loading) return;
    const next = pageNo + 1;
    const succeeded = await fetchPage(next, activeKeyword, sortOrderRef.current, 'append');
    // 失败时不推进页码 —— 否则下一次「加载更多」会从 pageNo + 1 起拉，
    // 失败的这一页被永久跳过。
    if (succeeded) setPageNo(next);
  }, [activeKeyword, fetchPage, loading, pageNo]);

  return {
    documents,
    total,
    loading,
    error,
    keyword,
    activeKeyword,
    setKeyword,
    pageNo,
    loadMore,
    hasMore: documents.length < total,
    reload,
    refresh,
    pollRefresh,
    pollUntilTotalGrows,
    sortOrder,
    toggleSortOrder,
  };
};
