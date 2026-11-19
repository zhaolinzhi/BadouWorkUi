/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库文档上传：请求契约（multipart 字段）、多文件、失败分支、401。
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

const { useKnowledgeBaseUpload } = await import('../useKnowledgeBaseUpload');

const UPLOAD_URL_FRAGMENT = '/project/aiknowledge/aiknowledgebasesavev2/uploadDocument.do';

const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => impl(String(input), init ?? {}));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** 造一个 File（jsdom 里 File 是可用的）。 */
const makeFile = (name: string, content = 'x') => new File([content], name, { type: 'text/plain' });

/** 从 FormData 里取某个字段的全部值（同名字段可能有多个）；文件取文件名。 */
const valuesOf = (body: FormData, key: string): string[] =>
  body.getAll(key).map((value) => (value instanceof File ? value.name : String(value)));

describe('useKnowledgeBaseUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitAuthExpired.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按规格发出 multipart 上传请求', async () => {
    const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1', onSuccess }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(UPLOAD_URL_FRAGMENT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Token: 'test-token' });
    // multipart 的 boundary 由浏览器生成 —— 不能手写 Content-Type。
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();

    const body = init.body as FormData;
    expect(body.get('fileType')).toBe('10');
    expect(body.get('parseMethod')).toBe('1');
    expect(body.get('visualModelCode')).toBe('');
    expect(body.get('promptWord')).toBe('');
    expect(body.get('flgExtractImage')).toBe('0');
    expect(body.get('flgContextParsing')).toBe('0');
    expect(body.get('knowledgeBaseId')).toBe('kb-1');
    expect(body.get('uploadType')).toBe('knowledgeBase');
    expect(valuesOf(body, 'attach')).toEqual(['a.md']);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('多个文件用同一个 attach 字段重复提交', async () => {
    const fetchMock = stubFetch(async () => new Response('', { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md'), makeFile('b.pdf')]);
    });

    await act(async () => {
      await result.current.submit();
    });

    const body = (fetchMock.mock.calls[0][1]?.body ?? new FormData()) as FormData;
    expect(valuesOf(body, 'attach')).toEqual(['a.md', 'b.pdf']);
  });

  it('同名同大小的文件不重复加入', async () => {
    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });
    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    expect(result.current.files).toHaveLength(1);
  });

  it('可以移除待上传文件', async () => {
    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md'), makeFile('b.md')]);
    });

    const target = result.current.files[0];
    await act(async () => {
      result.current.removeFile(target.uid);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe('b.md');
  });

  it('没有文件时不发请求，提示先选文件', async () => {
    const fetchMock = stubFetch(async () => new Response('', { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.submit();
    });

    expect(succeeded).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe('请先选择要上传的文件');
  });

  it('401 触发登出提示，且不算成功', async () => {
    stubFetch(async () => new Response('unauthorized', { status: 401 }));

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.submit();
    });

    expect(succeeded).toBe(false);
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
  });

  it('接口失败时记下错误', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.submit();
    });

    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('HTTP 500');
  });

  it('响应体明确表示失败时按失败处理', async () => {
    stubFetch(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.submit();
    });

    expect(succeeded).toBe(false);
  });

  it('响应体不是 JSON 也按成功处理（结构还没确认）', async () => {
    stubFetch(async () => new Response('ok', { status: 200 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1', onSuccess }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.submit();
    });

    expect(succeeded).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('reset 清空待上传列表与错误', async () => {
    const { result } = renderHook(() => useKnowledgeBaseUpload({ knowledgeBaseId: 'kb-1' }));

    await act(async () => {
      result.current.addFiles([makeFile('a.md')]);
    });
    await act(async () => {
      result.current.reset();
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
