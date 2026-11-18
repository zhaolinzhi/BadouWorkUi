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
import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppRuntime } from '../AppContext';

const DOCUMENT_LIST_URL = `${AIPAAS_BASE_URL}/jdbc/common/basecommonlist/listJSON.do?mdCode=view_knowledge_relevancy`;
const DOCUMENT_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

/** 接口返回的原始行。字段名以后端 listJSON.do 响应为准。 */
type RawDocumentRow = {
  id?: string | null;
  name?: string | null;
  flgType?: string | null;
  fileType?: string | null;
  processedTaskNum?: string | number | null;
  updateTime?: string | null;
};

type ListEnvelope = {
  Total?: number;
  Rows?: RawDocumentRow[];
};

const pickString = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

const pickNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** 原始行 → 领域模型。 */
const mapDocumentRow = (row: RawDocumentRow): KnowledgeBaseDocument => ({
  id: pickString(row.id),
  name: pickString(row.name),
  // `flgType` 是文件类型（'md' / 'docx' …），接口给的是小写，展示统一转大写；
  // 缺失时回落 `fileType`（数字码）。
  type: pickString(row.flgType).toUpperCase() || pickString(row.fileType),
  // 「N 条数据」—— 后端给的是字符串数字。
  records: pickNumber(row.processedTaskNum),
  updatedAt: pickString(row.updateTime),
});

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
  /** 上一次已处理的输入值 —— 用来区分「首次挂载」与「用户改了搜索词」。 */
  const prevKeyword = useRef('');

  /**
   * 请求序号。每次发请求自增；响应回来时序号对不上，说明已经有更新的请求了 ——
   * 这条响应直接丢掉，避免「先发的慢响应」覆盖「后发的快响应」。
   */
  const requestSeq = useRef(0);

  /**
   * 拉取一页数据。
   *
   * @returns 这次请求是否「成功落地」（数据或空列表已应用）。无 token / 无
   * knowledgeBaseId / 竞态丢弃 / 401 / 请求或解析失败均返回 false —— 调用方
   * 据此决定要不要推进页码，避免请求失败后永久跳过一页。
   */
  const fetchPage = useCallback(
    async (page: number, keywordValue: string, mode: 'replace' | 'append'): Promise<boolean> => {
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
        }).toString();

        const response = await fetch(DOCUMENT_LIST_URL, {
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
          }
          return true;
        }

        let data: ListEnvelope;
        try {
          data = JSON.parse(text) as ListEnvelope;
        } catch (parseError) {
          throw new Error(parseError instanceof Error ? parseError.message : 'Invalid JSON response', {
            cause: parseError,
          });
        }

        const rows = Array.isArray(data?.Rows) ? data.Rows : [];
        const mapped = rows.map(mapDocumentRow);
        setDocuments((prev) => (mode === 'append' ? [...prev, ...mapped] : mapped));
        setTotal(Number(data?.Total ?? 0));
        return true;
      } catch (err) {
        if (seq !== requestSeq.current) return false;
        console.error('[useKnowledgeBaseDocuments] failed to load documents:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        if (mode === 'replace') {
          setDocuments([]);
          setTotal(0);
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
      void fetchPage(1, trimmed, 'replace');
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword, fetchPage]);

  // 首次加载 / 换库：重置搜索与页码，拉第 1 页。
  //
  // `fetchPage` 的依赖是 [token, knowledgeBaseId]，所以这个 effect 只在
  // 首次挂载与换库时重跑。
  useEffect(() => {
    prevKeyword.current = '';
    setKeyword('');
    setActiveKeyword('');
    setPageNo(1);
    void fetchPage(1, '', 'replace');
  }, [fetchPage]);

  /** 重新拉当前页（错误态的「重试」按钮用）。 */
  const reload = useCallback(() => {
    void fetchPage(pageNo, activeKeyword, pageNo === 1 ? 'replace' : 'append');
  }, [activeKeyword, fetchPage, pageNo]);

  /** 加载下一页并追加。 */
  const loadMore = useCallback(async () => {
    if (loading) return;
    const next = pageNo + 1;
    const succeeded = await fetchPage(next, activeKeyword, 'append');
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
  };
};
