/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notifyTokenExpiredMock = vi.fn();

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    notifyTokenExpired: notifyTokenExpiredMock,
  }),
}));

const { useTaskCenterList } = await import('@/renderer/pages/task-center/useTaskCenterList');

const LIST_URL_FRAGMENT = '/jdbc/common/basecommonlist/listJSON.do?mdCode=y_project_task_mine';

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

const stubFetch = (impl: FetchImpl): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const emptyResponse = (status = 200): Response => new Response('', { status });

const errorResponse = (status: number): Response => new Response('upstream error', { status });

const sampleRow = {
  id: '1',
  name: '策略库调整',
  mark: 'BD-AIServices-T359',
  projectName: '八斗AI-应用服务支撑平台',
  projectId: 'p1',
  partName: '策略库管理',
  milestoneName: '2024.04.15',
  type: 0,
  typeDesc: '开发任务',
  urgency: 0,
  urgencyDesc: '紧急',
  status: 0,
  statusDesc: '未开展',
  deadlineTime: '2024-04-12',
  startTime: null,
  endTime: null,
  closeTime: null,
  creator: 'c',
  creatorName: '黄纯敏',
  currentUserId: 'u',
  currentUserName: '赵琳芝',
  updator: 'u',
  updatorName: '黄纯敏',
  createTime: '2024-04-10 09:57:08',
  updateTime: '2024-04-10 09:57:08',
  content: '1、列表策略定义按钮移动到每一行数据右侧操作字段',
  remark: null,
  raw: {},
};

beforeEach(() => {
  notifyTokenExpiredMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTaskCenterList — fetch path', () => {
  it('fetches on mount with empty keyword and renders rows + total', async () => {
    const fetchMock = stubFetch(async (url) => {
      expect(url).toContain(LIST_URL_FRAGMENT);
      return jsonResponse({ Total: 1, Rows: [sampleRow] });
    });

    const { result } = renderHook(() => useTaskCenterList('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.items[0]?.id).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('POST URL contains mdCode and request body contains default status entry', async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    stubFetch(async (url, init) => {
      captured = { url, init };
      return jsonResponse({ Total: 0, Rows: [] });
    });

    renderHook(() => useTaskCenterList('tok'));
    await waitFor(() => expect(captured).toBeDefined());

    expect(captured!.url).toMatch(/^https?:\/\/pm\.badousoft\.com\/platform\//);
    expect(captured!.url).toContain('mdCode=y_project_task_mine');
    expect(captured!.init?.method).toBe('POST');
    const headers = captured!.init?.headers as Record<string, string>;
    expect(headers['Token']).toBe('tok');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(captured!.init?.credentials).toBe('include');

    const body = String(captured!.init?.body ?? '');
    const params = new URLSearchParams(body);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([{ name: 'status', value: '0;1', type: 'other-query', tagName: '' }]);
  });

  it('appends a text-query entry for the keyword when keyword is provided', async () => {
    const capturedBodies: string[] = [];
    stubFetch(async (_url, init) => {
      capturedBodies.push(String(init?.body ?? ''));
      return jsonResponse({ Total: 0, Rows: [] });
    });

    const { result } = renderHook(() => useTaskCenterList('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const baselineCount = capturedBodies.length;

    act(() => result.current.setKeyword('策略'));
    await waitFor(() => expect(capturedBodies.length).toBeGreaterThan(baselineCount));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const lastBody = capturedBodies[capturedBodies.length - 1];
    const params = new URLSearchParams(lastBody);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([
      { name: 'status', value: '0;1', type: 'other-query', tagName: '' },
      { name: 'name', value: '策略', type: 'text-query', tagName: '' },
    ]);
  });

  it('sets error on HTTP non-2xx', async () => {
    stubFetch(async () => errorResponse(500));

    const { result } = renderHook(() => useTaskCenterList('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/HTTP 500/);
    expect(result.current.items).toHaveLength(0);
  });

  it('signals token_expired on 2xx empty body', async () => {
    stubFetch(async () => emptyResponse(200));

    const { result } = renderHook(() => useTaskCenterList('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/Empty response/);
    expect(notifyTokenExpiredMock).toHaveBeenCalledWith('task-center');
  });

  it('does NOT signal token_expired on non-2xx empty body', async () => {
    stubFetch(async () => emptyResponse(503));

    const { result } = renderHook(() => useTaskCenterList('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(notifyTokenExpiredMock).not.toHaveBeenCalled();
  });

  it('sets error on JSON parse failure', async () => {
    stubFetch(async () => new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const { result } = renderHook(() => useTaskCenterList('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(notifyTokenExpiredMock).not.toHaveBeenCalled();
  });

  it('loadMore appends the next page to items', async () => {
    const fetchMock = stubFetch(async (url, init) => {
      const params = new URLSearchParams(String(init?.body ?? ''));
      const pageNo = Number(params.get('pageNo') ?? '1');
      const items =
        pageNo === 1
          ? [
              { ...sampleRow, id: 'a', name: 'A' },
              { ...sampleRow, id: 'b', name: 'B' },
            ]
          : [
              { ...sampleRow, id: 'c', name: 'C' },
              { ...sampleRow, id: 'd', name: 'D' },
            ];
      return jsonResponse({ Total: 4, Rows: items });
    });

    const { result } = renderHook(() => useTaskCenterList('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toHaveLength(4);
    expect(result.current.pageNo).toBe(2);
    expect(result.current.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when token is empty', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));
    const { result } = renderHook(() => useTaskCenterList(''));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it('clears keyword and resets to page 1 on reset()', async () => {
    stubFetch(async () => jsonResponse({ Total: 0, Rows: [] }));

    const { result } = renderHook(() => useTaskCenterList('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setKeyword('foo'));
    await waitFor(() => expect(result.current.keyword).toBe('foo'));
    act(() => result.current.reset());
    expect(result.current.keyword).toBe('');
  });
});
