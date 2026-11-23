/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 删除知识库文档：请求契约、成功/失败分支、401、缺参数。
 *
 * token 来自 shell 注入的 `useAppRuntime()` —— 这里直接把 Context mock 掉。
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitAuthExpired = vi.fn();

vi.mock('@aionui/microapp-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aionui/microapp-shared')>()),
  emitAuthExpired,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'test-token' }),
}));

const { useKnowledgeBaseDocumentDelete } = await import('../useKnowledgeBaseDocumentDelete');

const DELETE_URL_FRAGMENT = '/project/aiknowledge/aiknowledgebasedelete/cancelUsingKnowledge.do';

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

describe('useKnowledgeBaseDocumentDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitAuthExpired.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按规格发出删除请求', async () => {
    const fetchMock = stubFetch(async () => new Response('', { status: 200 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseDocumentDelete({ knowledgeBaseId: 'kb-1', onSuccess }));

    await act(async () => {
      await result.current.remove('doc-1');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(DELETE_URL_FRAGMENT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Token: 'test-token',
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    const body = parseBody(init);
    expect(body.knowledgeId).toBe('doc-1');
    expect(body.knowledgeBaseId).toBe('kb-1');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('401 触发登出提示，且不算成功', async () => {
    stubFetch(async () => new Response('unauthorized', { status: 401 }));

    const { result } = renderHook(() => useKnowledgeBaseDocumentDelete({ knowledgeBaseId: 'kb-1' }));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.remove('doc-1');
    });

    expect(succeeded).toBe(false);
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
  });

  it('接口失败时记下错误', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));

    const { result } = renderHook(() => useKnowledgeBaseDocumentDelete({ knowledgeBaseId: 'kb-1' }));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.remove('doc-1');
    });

    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('HTTP 500');
  });

  it('缺参数时不发请求', async () => {
    const fetchMock = stubFetch(async () => new Response('', { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseDocumentDelete({}));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.remove('doc-1');
    });

    expect(succeeded).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('删除失败，请稍后重试');
  });
});
