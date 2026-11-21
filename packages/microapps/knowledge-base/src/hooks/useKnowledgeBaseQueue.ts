/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列的数据层。
 *
 * 接口与文档列表是同一个（`view_knowledge_relevancy`），但请求体是**队列自己的**
 * 一组固定参数 —— 不跟着页面上的搜索词 / 排序走：
 *   - `defaultSearchParam` —— `knowledgeBaseId` 的 exact-match 过滤
 *   - `searchParam`        —— 空数组（队列不按文件名搜）
 *   - `pageNo` / `perPageSize` —— 第 1 页、每页 30 条
 *
 * 进度取行上的 `progress` 字段：后端解析进度时会更新它，100 即处理完成。
 *
 * 面板打开期间轮询 —— 不刷新就看不到进度变化；全都处理完之后停掉，别一直
 * 打扰后端。
 */

import type { KnowledgeBaseDocument } from '../types';
import type { KnowledgeBaseDocumentListEnvelope } from '../utils/knowledgeBaseUtils';
import { KNOWLEDGE_DOCUMENT_LIST_URL, mapKnowledgeDocumentRow } from '../utils/knowledgeBaseUtils';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppRuntime } from '../AppContext';

/** 队列固定取第 1 页、每页 30 条。 */
const QUEUE_PAGE_SIZE = 30;
/** 轮询间隔 —— 后端解析进度大约按秒级更新。 */
const QUEUE_POLL_INTERVAL_MS = 2000;

/**
 * 文件是否还在处理中。
 *
 * 状态来自接口的 `flgSplit`（`1` 已解析 / `-1` 解析失败 / 其它 处理中）。
 */
const isProcessing = (item: KnowledgeBaseDocument): boolean => item.splitStatus === 'processing';

/**
 * 拉取文件处理队列。
 *
 * @param knowledgeBaseId 知识库 id；为空时不发请求。
 * @param enabled         面板是否打开 —— 关闭时不发请求、不轮询。
 */
export const useKnowledgeBaseQueue = (knowledgeBaseId: string | undefined, enabled: boolean) => {
  const { token } = useAppRuntime();

  const [items, setItems] = useState<KnowledgeBaseDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 请求序号 —— 响应回来时对不上就丢掉，避免旧响应覆盖新响应。 */
  const requestSeq = useRef(0);

  /** 当前队列内容 —— 轮询里用它判断「还有没有在处理的文件」。 */
  const itemsRef = useRef<KnowledgeBaseDocument[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /**
   * 拉一次队列。
   *
   * @returns 这次请求是否成功落地（数据已应用）。
   */
  const fetchQueue = useCallback(async (): Promise<boolean> => {
    if (!token || !knowledgeBaseId) return false;
    const seq = ++requestSeq.current;
    // 只有「还没有内容」时才显示 loading —— 轮询刷新不该让面板闪一下骨架。
    if (itemsRef.current.length === 0) setLoading(true);
    setError(null);
    try {
      const defaultSearchParam = [{ name: 'knowledgeBaseId', value: knowledgeBaseId, type: 'exact-match' }];
      const body = new URLSearchParams({
        defaultSearchParam: JSON.stringify(defaultSearchParam),
        searchParam: JSON.stringify([]),
        pageNo: '1',
        perPageSize: String(QUEUE_PAGE_SIZE),
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

      if (response.status === 401) {
        emitAuthExpired('knowledge-base');
        return false;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      if (seq !== requestSeq.current) return false;

      // 空 body 按「没有数据」处理，不踢登录。
      if (text.trim() === '') {
        setItems([]);
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
      setItems(rows.map(mapKnowledgeDocumentRow));
      return true;
    } catch (err) {
      if (seq !== requestSeq.current) return false;
      console.error('[useKnowledgeBaseQueue] failed to load queue:', err);
      setError(err instanceof Error ? err.message : 'unknown error');
      return false;
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [token, knowledgeBaseId]);

  // 面板打开 → 拉一次。
  useEffect(() => {
    if (!enabled) return;
    void fetchQueue();
  }, [enabled, fetchQueue]);

  /*
   * 轮询刷新。
   *
   * 进度是后端在后台推进的 —— 不轮询就永远停在打开那一刻的数字上。
   * 全都处理完之后停掉（`itemsRef` 里没有在处理的文件了），别一直打扰后端。
   */
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const pending = itemsRef.current.some(isProcessing);
      if (!pending) return;
      void fetchQueue();
    }, QUEUE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, fetchQueue]);

  /** 手动刷新（上传完成后调用）。 */
  const refresh = useCallback(async () => {
    return fetchQueue();
  }, [fetchQueue]);

  return {
    items,
    loading,
    error,
    refresh,
  };
};
