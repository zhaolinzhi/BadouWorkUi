/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import {
  TASK_CENTER_DEFAULT_PER_PAGE_SIZE,
  TASK_CENTER_TIMEOUT_MS,
  buildTaskCenterListUrl,
} from '@/renderer/api';

export interface TaskCenterRow {
  id: string;
  name: string;
  mark: string;
  projectName: string;
  projectId: string;
  partName: string;
  milestoneName: string;
  type: number;
  typeDesc: string;
  urgency: number;
  urgencyDesc: string;
  status: number;
  statusDesc: string;
  deadlineTime: string | null;
  startTime: string | null;
  endTime: string | null;
  closeTime: string | null;
  creator: string;
  creatorName: string;
  currentUserId: string;
  currentUserName: string;
  updator: string;
  updatorName: string;
  createTime: string;
  updateTime: string;
  content: string | null;
  remark: string | null;
  raw: Record<string, unknown>;
}

export interface UseTaskCenterListResult {
  items: TaskCenterRow[];
  total: number;
  loading: boolean;
  error: string | null;
  keyword: string;
  pageNo: number;
  perPageSize: number;
  setKeyword: (v: string) => void;
  setPageNo: (v: number) => void;
  setPerPageSize: (v: number) => void;
  reset: () => void;
  reload: () => void;
  loadMore: () => void;
}

const DEBOUNCE_MS = 300;

const pickString = (row: Record<string, unknown>, key: string): string => {
  const v = row[key];
  return v === null || v === undefined ? '' : String(v);
};

const pickNullableString = (row: Record<string, unknown>, key: string): string | null => {
  const v = row[key];
  if (v === null || v === undefined || v === '') return null;
  return String(v);
};

const pickNumber = (row: Record<string, unknown>, key: string): number => {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeRow = (row: Record<string, unknown>): TaskCenterRow => ({
  id: pickString(row, 'id'),
  name: pickString(row, 'name'),
  mark: pickString(row, 'mark'),
  projectName: pickString(row, 'projectName'),
  projectId: pickString(row, 'projectId'),
  partName: pickString(row, 'partName'),
  milestoneName: pickString(row, 'milestoneName'),
  type: pickNumber(row, 'type'),
  typeDesc: pickString(row, 'typeDesc'),
  urgency: pickNumber(row, 'urgency'),
  urgencyDesc: pickString(row, 'urgencyDesc'),
  status: pickNumber(row, 'status'),
  statusDesc: pickString(row, 'statusDesc'),
  deadlineTime: pickNullableString(row, 'deadlineTime'),
  startTime: pickNullableString(row, 'startTime'),
  endTime: pickNullableString(row, 'endTime'),
  closeTime: pickNullableString(row, 'closeTime'),
  creator: pickString(row, 'creator'),
  creatorName: pickString(row, 'creatorName'),
  currentUserId: pickString(row, 'currentUserId'),
  currentUserName: pickString(row, 'currentUserName'),
  updator: pickString(row, 'updator'),
  updatorName: pickString(row, 'updatorName'),
  createTime: pickString(row, 'createTime'),
  updateTime: pickString(row, 'updateTime'),
  content: pickNullableString(row, 'content'),
  remark: pickNullableString(row, 'remark'),
  raw: row,
});

export const useTaskCenterList = (token: string): UseTaskCenterListResult => {
  const [items, setItems] = useState<TaskCenterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeywordState] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [perPageSize, setPerPageSize] = useState(TASK_CENTER_DEFAULT_PER_PAGE_SIZE);
  const { notifyTokenExpired } = useAuth();

  const setKeyword = useCallback((v: string) => {
    setKeywordState(v);
  }, []);

  // Debounce keyword propagation + reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPageNo(1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keyword]);

  const fetchOnce = useCallback(
    async (mode: 'replace' | 'append' = 'replace', overridePage?: number) => {
      if (!token) return;
      setLoading(true);
      setError(null);

      const trimmed = debouncedKeyword.trim();
      const listUrl = buildTaskCenterListUrl({
        urgency: 'all',
        projectId: 'all',
        type: 'all',
        keyword: trimmed,
      });

      const searchParam: Array<Record<string, string>> = [
        { name: 'status', value: '0;1', type: 'other-query', tagName: '' },
      ];
      if (trimmed) searchParam.push({ name: 'name', value: trimmed, type: 'text-query', tagName: '' });

      const body = new URLSearchParams({
        searchParam: JSON.stringify(searchParam),
        pageNo: String(overridePage ?? pageNo),
        perPageSize: String(perPageSize),
      }).toString();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TASK_CENTER_TIMEOUT_MS);

      try {
        const res = await fetch(listUrl, {
          method: 'POST',
          headers: {
            Token: token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          credentials: 'include',
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          if (mode === 'replace') {
            setItems([]);
            setTotal(0);
          }
          setError(`HTTP ${res.status}`);
          return;
        }

        const text = await res.text();
        if (text.length === 0) {
          if (mode === 'replace') {
            setItems([]);
            setTotal(0);
          }
          setError('Empty response from PM center (token may be expired)');
          notifyTokenExpired('task-center');
          return;
        }

        let parsed: { Total?: number; Rows?: Array<Record<string, unknown>> };
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          if (mode === 'replace') {
            setItems([]);
            setTotal(0);
          }
          setError(err instanceof Error ? err.message : String(err));
          return;
        }

        const totalCount = Number(parsed.Total ?? 0);
        const newItems = (parsed.Rows ?? []).map((row) => normalizeRow(row));
        setItems((prev) => (mode === 'append' ? [...prev, ...newItems] : newItems));
        setTotal(totalCount);
        setError(null);
      } catch (e) {
        clearTimeout(timer);
        if (mode === 'replace') {
          setItems([]);
          setTotal(0);
        }
        const message =
          e instanceof Error && e.name === 'AbortError' ? `Request timeout (${TASK_CENTER_TIMEOUT_MS}ms)` : e instanceof Error ? e.message : String(e);
        setError(message);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    [token, notifyTokenExpired, debouncedKeyword, pageNo, perPageSize]
  );

  // The auto effect below refetches when filters/pageNo change. loadMore
  // also advances pageNo, but we don't want that to trigger a re-replace.
  // We use this flag to skip the next auto-effect run right after loadMore
  // bumped pageNo.
  const skipNextAutoFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextAutoFetchRef.current) {
      skipNextAutoFetchRef.current = false;
      return;
    }
    void fetchOnce('replace');
  }, [fetchOnce]);

  const reload = useCallback(() => {
    void fetchOnce('replace');
  }, [fetchOnce]);

  const loadMore = useCallback(async () => {
    if (loading) return;
    const nextPage = pageNo + 1;
    skipNextAutoFetchRef.current = true;
    await fetchOnce('append', nextPage);
    setPageNo(nextPage);
  }, [fetchOnce, loading, pageNo]);

  const reset = useCallback(() => {
    setKeywordState('');
    setDebouncedKeyword('');
    setPageNo(1);
  }, []);

  return useMemo(
    () => ({
      items,
      total,
      loading,
      error,
      keyword,
      pageNo,
      perPageSize,
      setKeyword,
      setPageNo,
      setPerPageSize,
      reset,
      reload,
      loadMore,
    }),
    [items, total, loading, error, keyword, pageNo, perPageSize, setKeyword, reset, reload, loadMore]
  );
};