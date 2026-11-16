/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 「添加到知识库」下拉的知识库列表:懒加载 + 追加式翻页。
 *
 * 锁四件事:
 *   1. 菜单没打开过就不发请求(笔记列表里每一行都包着这个菜单)。
 *   2. 第一页带上 `pageNo` / `perPageSize`。
 *   3. 「加载更多」拉下一页并追加,按 id 去重。
 *   4. 后端不认分页参数时(每次返回同一批),「加载更多」自己消失。
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../AppContext', () => ({
  useAppContext: () => ({ token: 'test-token' }),
}));

const emitAuthExpired = vi.fn();
vi.mock('@aionui/microapp-shared', () => ({
  emitAuthExpired: (...args: unknown[]) => emitAuthExpired(...args),
}));

import { useKnowledgeBaseOptions } from '../useKnowledgeBaseOptions';

const PERSONAL_URL_FRAGMENT = '/project/aiknowledge/aiknowledgebaselist/listJSON.do?mdCode=view_knowledge_user';
const SHARED_URL_FRAGMENT = '/jdbc/common/basecommonlist/listJSON.do?mdCode=share_knowledge_base';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify(body) : '', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const stubFetch = (impl: (url: string) => Promise<Response>) => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => impl(String(input)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const rows = (prefix: string, count: number) =>
  Array.from({ length: count }, (_unused, index) => ({
    id: `${prefix}_${index + 1}`,
    name: `${prefix} ${index + 1}`,
    fileCount: index,
  }));

describe('useKnowledgeBaseOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('菜单没打开过就不发请求', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Rows: [] }));

    renderHook(() => useKnowledgeBaseOptions());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ensureLoaded 拉第一页:个人 + 共享各一次,带上分页参数', async () => {
    const fetchMock = stubFetch(async (url) => {
      if (url.includes(PERSONAL_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('p', 1) });
      if (url.includes(SHARED_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('s', 1) });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });

    await waitFor(() => {
      expect(result.current.personalItems).toHaveLength(1);
      expect(result.current.sharedItems).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls as unknown as Array<[string]>) {
      expect(url).toContain('pageNo=1');
      expect(url).toContain('perPageSize=20');
    }
    for (const [, options] of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(options.headers).toMatchObject({ Token: 'test-token' });
    }
  });

  it('ensureLoaded 只拉一次 —— 菜单反复开关不重复请求', async () => {
    const fetchMock = stubFetch(async (url) => {
      if (url.includes(PERSONAL_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('p', 1) });
      if (url.includes(SHARED_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('s', 1) });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });
    await waitFor(() => expect(result.current.personalItems).toHaveLength(1));

    act(() => {
      result.current.ensureLoaded();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('「加载更多」拉下一页并追加', async () => {
    const requestedPages: string[] = [];
    stubFetch(async (url) => {
      requestedPages.push(url);
      if (url.includes(PERSONAL_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('p', 1) });
      if (url.includes(SHARED_URL_FRAGMENT)) {
        const pageNo = new URL(url).searchParams.get('pageNo');
        return pageNo === '1'
          ? jsonResponse({ Total: 2, Rows: rows('s', 1) })
          : jsonResponse({ Total: 2, Rows: [{ id: 's_2', name: 's 2' }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });
    await waitFor(() => expect(result.current.sharedItems).toHaveLength(1));

    // 总数 2、已加载 1 → 还有下一页
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.sharedItems).toHaveLength(2));
    expect(result.current.sharedItems[1]?.id).toBe('s_2');
    expect(requestedPages.some((url) => url.includes('pageNo=2'))).toBe(true);
    // 全都加载完了 → 没有下一页了
    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  it('后端不认分页参数(每次返回同一批)时,「加载更多」自己消失', async () => {
    stubFetch(async (url) => {
      // 满页(20 条)且没有 Total —— 后端把分页参数忽略了
      if (url.includes(PERSONAL_URL_FRAGMENT)) return jsonResponse({ Rows: rows('p', 20) });
      if (url.includes(SHARED_URL_FRAGMENT)) return jsonResponse({ Rows: rows('s', 20) });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });
    await waitFor(() => expect(result.current.personalItems).toHaveLength(20));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    await act(async () => {
      result.current.loadMore();
    });

    // 一条新的都没有 → 不再让用户白点
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.personalItems).toHaveLength(20);
  });

  it('拉列表失败时记下错误,下一次打开菜单会重试', async () => {
    let failed = true;
    stubFetch(async (url) => {
      if (failed) throw new Error('network down');
      if (url.includes(PERSONAL_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('p', 1) });
      if (url.includes(SHARED_URL_FRAGMENT)) return jsonResponse({ Total: 1, Rows: rows('s', 1) });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });

    await waitFor(() => expect(result.current.error).toBe('network down'));

    failed = false;
    act(() => {
      result.current.ensureLoaded();
    });

    await waitFor(() => expect(result.current.personalItems).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });

  it('401 走 emitAuthExpired 回传给 shell', async () => {
    stubFetch(async () => jsonResponse({}, 401));

    const { result } = renderHook(() => useKnowledgeBaseOptions());

    act(() => {
      result.current.ensureLoaded();
    });

    await waitFor(() => expect(emitAuthExpired).toHaveBeenCalledWith('notes'));
    expect(result.current.personalItems).toEqual([]);
  });
});
