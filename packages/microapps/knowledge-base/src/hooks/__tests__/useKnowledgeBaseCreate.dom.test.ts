/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建知识库的保存逻辑：请求契约、成功/失败分支、401、共享分支。
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'test-token' }),
}));

const { useKnowledgeBaseCreate } = await import('../useKnowledgeBaseCreate');

const SAVE_URL_FRAGMENT = '/project/aiknowledge/aiknowledgebasesavev2/saveIncludeFile.do?mdCode=ai_knowledge_user';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

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

describe('useKnowledgeBaseCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitAuthExpired.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按规格发出保存请求', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({}));

    const { result } = renderHook(() => useKnowledgeBaseCreate());

    await act(async () => {
      await result.current.submit({
        name: '测试3',
        description: '121212',
        scope: 'personal',
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(SAVE_URL_FRAGMENT);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Token: 'test-token',
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    expect(parseBody(init)).toEqual({
      parentName: '知识库目录',
      parentId: 'ROOT',
      name: '测试3',
      remarks: '121212',
      isCreateByDefaultConfig: 'true',
    });
  });

  it('保存成功时返回 true 并回调 onSuccess', async () => {
    stubFetch(async () => jsonResponse({}));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseCreate({ onSuccess }));

    let ok = false;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('名称与描述会 trim 后再提交', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({}));

    const { result } = renderHook(() => useKnowledgeBaseCreate());

    await act(async () => {
      await result.current.submit({ name: '  测试3  ', description: '  121212  ', scope: 'personal' });
    });

    const body = parseBody((fetchMock.mock.calls[0] as [string, RequestInit])[1]);
    expect(body.name).toBe('测试3');
    expect(body.remarks).toBe('121212');
  });

  it('401 触发登出事件且不回调 onSuccess', async () => {
    stubFetch(async () => new Response('unauthorized', { status: 401 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseCreate({ onSuccess }));

    let ok = true;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(ok).toBe(false);
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('非 2xx 写 error 状态且不回调 onSuccess', async () => {
    stubFetch(async () => new Response('boom', { status: 500 }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseCreate({ onSuccess }));

    let ok = true;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('HTTP 500');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('网络异常写 error 状态', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });

    const { result } = renderHook(() => useKnowledgeBaseCreate());

    await act(async () => {
      await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(result.current.error).toBe('network down');
  });

  it('业务失败（hasOk: false）提示「新增失败」且不回调 onSuccess', async () => {
    stubFetch(async () => jsonResponse({ hasOk: false, tip: 'FAIL', message: null, bean: null, save: false }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseCreate({ onSuccess }));

    let ok = true;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('新增失败');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('业务失败但带 message 时展示平台给的提示', async () => {
    stubFetch(async () => jsonResponse({ hasOk: false, tip: 'FAIL', message: '知识库名称已存在' }));

    const { result } = renderHook(() => useKnowledgeBaseCreate());

    await act(async () => {
      await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(result.current.error).toBe('知识库名称已存在');
  });

  it('业务成功（hasOk: true）照旧回调 onSuccess', async () => {
    stubFetch(async () => jsonResponse({ hasOk: true, bean: { id: 'kb-9' }, save: true }));
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useKnowledgeBaseCreate({ onSuccess }));

    let ok = false;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'personal' });
    });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('选共享知识库时不发请求并明确报错', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({}));

    const { result } = renderHook(() => useKnowledgeBaseCreate());

    let ok = true;
    await act(async () => {
      ok = await result.current.submit({ name: '测试3', description: '', scope: 'shared', target: '产品设计团队' });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('共享知识库创建接口暂未接入');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
