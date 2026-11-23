/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列的数据层：固定请求参数、progress 映射、轮询、错误分支。
 *
 * token 来自 shell 注入的 `useAppRuntime()`，子应用在 qiankun 沙箱里够不到
 * shell 的 `useAuth()` —— 这里直接把 Context mock 掉。
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitAuthExpired = vi.fn();

vi.mock('@aionui/microapp-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aionui/microapp-shared')>()),
  emitAuthExpired,
}));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'test-token' }),
}));

const { useKnowledgeBaseQueue } = await import('../useKnowledgeBaseQueue');

const DOC_URL_FRAGMENT = '/jdbc/common/basecommonlist/listJSON.do?mdCode=view_knowledge_relevancy';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** 接口的一行 —— `flgSplit` 决定解析状态（1 已解析 / -1 解析失败 / 其它 处理中）。 */
const docRow = (id: string, name: string, flgSplit: number, progress?: number) => ({
  id,
  name,
  flgType: 'md',
  fileType: '10',
  processedTaskNum: '12',
  flgSplit,
  updateTime: '2026-11-17 15:09:47.0',
  createTime: '2026-11-17',
  ...(progress === undefined ? {} : { progress }),
});

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init ?? {}));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** 解析 form-urlencoded 请求体成普通对象。 */
const parseBody = (init: RequestInit): Record<string, string> => {
  const params = new URLSearchParams(String(init.body ?? ''));
  return Object.fromEntries(params.entries());
};

describe('useKnowledgeBaseQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitAuthExpired.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('面板打开时按固定参数请求：knowledgeBaseId 过滤、空搜索、第 1 页每页 30 条', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'a.md', 0, 40)] }));

    const { result } = renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(DOC_URL_FRAGMENT);

    const body = parseBody(init);
    expect(JSON.parse(body.defaultSearchParam)).toEqual([
      { name: 'knowledgeBaseId', value: 'kb-1', type: 'exact-match' },
    ]);
    expect(JSON.parse(body.searchParam)).toEqual([]);
    expect(body.pageNo).toBe('1');
    expect(body.perPageSize).toBe('30');
    // 队列不跟页面上的排序走 —— 不带排序参数。
    expect(body.sortorder).toBeUndefined();
    expect(body.sortname).toBeUndefined();

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].progress).toBe(40);
  });

  it('面板没打开时不发请求', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    renderHook(() => useKnowledgeBaseQueue('kb-1', false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('progress 是数字字符串时也映射成数字', async () => {
    stubFetch(async () => jsonResponse({ Total: 1, Rows: [{ ...docRow('d1', 'a.md', 0), progress: '55' }] }));

    const { result } = renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.items[0].progress).toBe(55);
  });

  it('按 flgSplit 映射解析状态：1 已解析 / -1 解析失败 / 其它 处理中', async () => {
    stubFetch(async () =>
      jsonResponse({
        Total: 3,
        Rows: [docRow('d1', 'a.md', 1), docRow('d2', 'b.xlsx', -1), docRow('d3', 'c.doc', 0)],
      })
    );

    const { result } = renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.items.map((item) => item.splitStatus)).toEqual(['done', 'failed', 'processing']);
  });

  it('有文件在处理中时轮询刷新进度', async () => {
    vi.useFakeTimers();
    let progress = 40;
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'a.md', 0, progress)] }));

    const { result } = renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].progress).toBe(40);

    progress = 80;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.items[0].progress).toBe(80);
  });

  it('全都处理完之后不再轮询', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'a.md', 1, 100)] }));

    renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('请求失败时给出错误信息', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));

    const { result } = renderHook(() => useKnowledgeBaseQueue('kb-1', true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});
