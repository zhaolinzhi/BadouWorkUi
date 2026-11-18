/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库文档列表（产品设计资料页）的数据层：
 * 请求参数、字段映射、分页追加、搜索重置、错误分支、竞态保护。
 *
 * token 来自 shell 注入的 `useAppRuntime()`，子应用在 qiankun 沙箱里够不到
 * shell 的 `useAuth()` —— 这里直接把 Context mock 掉。
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitAuthExpired = vi.fn();

vi.mock('@aionui/microapp-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aionui/microapp-shared')>()),
  emitAuthExpired,
}));

// token 需要可被个别用例改成空串（验证「无 token 不发请求」），用 hoisted
// 变量承载 —— vi.mock 的工厂比文件里任何 import 都先执行。
const { mockToken } = vi.hoisted(() => ({ mockToken: { current: 'test-token' } }));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: mockToken.current }),
}));

const { useKnowledgeBaseDocuments } = await import('../useKnowledgeBaseDocuments');

const DOC_URL_FRAGMENT = '/jdbc/common/basecommonlist/listJSON.do?mdCode=view_knowledge_relevancy';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const docRow = (id: string, name: string) => ({
  id,
  name,
  flgType: 'md',
  fileType: '10',
  processedTaskNum: '268',
  updateTime: '2026-11-17 15:09:47.0',
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

describe('useKnowledgeBaseDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitAuthExpired.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // 恢复默认 token，避免「token 为空」用例污染后续用例。
    mockToken.current = 'test-token';
  });

  it('首次加载带上 knowledgeBaseId 过滤与分页参数', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'AppIcon.md')] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(DOC_URL_FRAGMENT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Token: 'test-token',
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const body = parseBody(init);
    expect(JSON.parse(body.defaultSearchParam)).toEqual([
      { name: 'knowledgeBaseId', value: 'kb-1', type: 'exact-match' },
    ]);
    expect(JSON.parse(body.searchParam)).toEqual([]);
    expect(body.pageNo).toBe('1');
    expect(body.perPageSize).toBe('30');
    // 排序参数随请求一起发
    expect(body.sortorder).toBe('desc');
    expect(body.sortname).toBe('createTime');
  });

  it('切换排序方向会用新的 sortorder 重新请求第 1 页', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.sortOrder).toBe('desc');

    await act(async () => {
      result.current.toggleSortOrder();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.sortOrder).toBe('asc');

    const body = parseBody((fetchMock.mock.calls[1] as [string, RequestInit])[1]);
    expect(body.sortorder).toBe('asc');
    expect(body.sortname).toBe('createTime');
    expect(body.pageNo).toBe('1');
  });

  it('把接口行映射成领域模型', async () => {
    stubFetch(async () =>
      jsonResponse({
        Total: 1,
        Rows: [
          {
            id: '8a748059a19f836201a1e85720b8063b',
            name: 'AppIcon.md',
            flgType: 'md',
            fileType: '10',
            processedTaskNum: '268',
            updateTime: '2026-11-17 15:09:47.0',
            createTime: '2026-11-17',
          },
        ],
      })
    );

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    expect(result.current.documents[0]).toEqual({
      id: '8a748059a19f836201a1e85720b8063b',
      name: 'AppIcon.md',
      type: 'MD',
      records: 268,
      updatedAt: '2026-11-17 15:09:47.0',
      createdAt: '2026-11-17',
    });
    expect(result.current.total).toBe(1);
  });

  it('缺少 flgType 时回落到 fileType', async () => {
    stubFetch(async () => jsonResponse({ Total: 1, Rows: [{ id: 'd1', name: 'a.txt', fileType: '10' }] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    expect(result.current.documents[0]?.type).toBe('10');
    expect(result.current.documents[0]?.records).toBe(0);
  });

  it('缺少 Rows 时当作空列表', async () => {
    stubFetch(async () => jsonResponse({ Total: 0 }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('加载更多请求下一页并追加到已有列表', async () => {
    let call = 0;
    const fetchMock = stubFetch(async () => {
      call += 1;
      return jsonResponse({ Total: 2, Rows: [docRow(`d${call}`, `doc-${call}.md`)] });
    });

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.documents).toHaveLength(2));
    expect(result.current.documents.map((d) => d.id)).toEqual(['d1', 'd2']);

    const secondBody = parseBody((fetchMock.mock.calls[1] as [string, RequestInit])[1]);
    expect(secondBody.pageNo).toBe('2');
    expect(result.current.hasMore).toBe(false);
  });

  it('全部加载完后 hasMore 为 false', async () => {
    stubFetch(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'doc-1.md')] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });

  it('搜索词防抖后按文件名查询并回到第 1 页', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setKeyword('设计');
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });

    const body = parseBody((fetchMock.mock.calls[1] as [string, RequestInit])[1]);
    expect(JSON.parse(body.searchParam)).toEqual([{ name: 'name', value: '设计', type: 'text-query', tagName: '' }]);
    expect(body.pageNo).toBe('1');
    expect(result.current.activeKeyword).toBe('设计');
  });

  it('搜索会替换已有列表而不是追加', async () => {
    let call = 0;
    stubFetch(async () => {
      call += 1;
      return jsonResponse({ Total: 1, Rows: [docRow(`d${call}`, `doc-${call}.md`)] });
    });

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));
    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    act(() => {
      result.current.setKeyword('设计');
    });

    await waitFor(() => expect(result.current.documents).toHaveLength(1), { timeout: 3000 });
    await waitFor(() => expect(result.current.documents[0]?.id).toBe('d2'), { timeout: 3000 });
  });

  it('401 触发登出事件', async () => {
    stubFetch(async () => new Response('unauthorized', { status: 401 }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(emitAuthExpired).toHaveBeenCalled());
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
    expect(result.current.error).toBeNull();
  });

  it('空 body 当作空列表，不踢登录', async () => {
    stubFetch(async () => new Response('', { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('非 2xx 写 error 状态且不踢登录', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));
    expect(result.current.documents).toEqual([]);
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('JSON 解析失败写 error 状态', async () => {
    stubFetch(async () => new Response('not json {', { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.error).toMatch(/JSON/i));
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('迟到的旧响应不会覆盖新结果', async () => {
    let call = 0;
    let resolveFirst!: (r: Response) => void;
    stubFetch(async () => {
      call += 1;
      if (call === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return jsonResponse({ Total: 1, Rows: [docRow('new', 'new.md')] });
    });

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    act(() => {
      result.current.setKeyword('x');
    });

    await waitFor(() => expect(call).toBe(2), { timeout: 3000 });
    await waitFor(() => expect(result.current.documents.map((d) => d.id)).toEqual(['new']), { timeout: 3000 });

    await act(async () => {
      resolveFirst(jsonResponse({ Total: 1, Rows: [docRow('old', 'old.md')] }));
    });

    expect(result.current.documents.map((d) => d.id)).toEqual(['new']);
  });

  it('翻页失败后不推进页码，重试仍请求同一页', async () => {
    let call = 0;
    const fetchMock = stubFetch(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ Total: 60, Rows: [docRow('d1', 'doc-1.md')] });
      if (call === 2) return new Response('boom', { status: 500 });
      return jsonResponse({ Total: 60, Rows: [docRow('d2', 'doc-2.md')] });
    });

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));
    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    // 第 2 页请求失败：页码停在 1，第 1 页数据保留。
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.error).toBe('HTTP 500'));
    expect(result.current.pageNo).toBe(1);
    expect(result.current.documents).toHaveLength(1);

    // 再点一次「加载更多」，请求的仍是第 2 页（而不是被跳过的第 3 页）。
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.documents).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryBody = parseBody((fetchMock.mock.calls[2] as [string, RequestInit])[1]);
    expect(retryBody.pageNo).toBe('2');
    expect(result.current.pageNo).toBe(2);
  });

  it('切换知识库时重置搜索并按新 id 重新查询', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result, rerender } = renderHook((props: { id: string }) => useKnowledgeBaseDocuments(props.id), {
      initialProps: { id: 'kb-1' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // 先让搜索词生效
    act(() => {
      result.current.setKeyword('设计');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });

    // 换库
    rerender({ id: 'kb-2' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const switchBody = parseBody((fetchMock.mock.calls[2] as [string, RequestInit])[1]);
    expect(JSON.parse(switchBody.defaultSearchParam)).toEqual([
      { name: 'knowledgeBaseId', value: 'kb-2', type: 'exact-match' },
    ]);
    // 搜索词被重置 —— 新请求不带搜索条件
    expect(JSON.parse(switchBody.searchParam)).toEqual([]);

    // 等过防抖窗口，确认没有多发一次重复请求
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('knowledgeBaseId 为空时不发请求', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.documents).toEqual([]);
  });

  it('token 为空时不发请求', async () => {
    mockToken.current = '';
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result } = renderHook(() => useKnowledgeBaseDocuments('kb-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.documents).toEqual([]);
  });
});
