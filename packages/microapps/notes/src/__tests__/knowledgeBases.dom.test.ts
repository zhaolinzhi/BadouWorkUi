/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「上传文档到知识库」的请求形状与失败处理。
 *
 * 锁四件事:
 *   1. 请求打到 `uploadDocument.do`,`Token` 头 + multipart 表单。
 *   2. 表单字段:除 knowledgeBaseId 与 attach 外都是平台默认值。
 *   3. attach 是笔记的 markdown(文件名带 .md)。
 *   4. 业务失败(`hasOk: false`)抛平台给的 message;401 走 emitAuthExpired。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitAuthExpired = vi.fn();
vi.mock('@aionui/microapp-shared', () => ({
  emitAuthExpired: (...args: unknown[]) => emitAuthExpired(...args),
}));

import { uploadDocumentToKnowledgeBase } from '../api/knowledgeBases';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(status === 200 ? JSON.stringify(body) : '', {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** 装一个 fetch 桩,并返回它(用来翻请求参数)。 */
const stubFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => impl(String(input), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const upload = (overrides: Partial<Parameters<typeof uploadDocumentToKnowledgeBase>[0]> = {}) =>
  uploadDocumentToKnowledgeBase({
    knowledgeBaseId: 'kb-1',
    token: 'test-token',
    fileName: '会议纪要.md',
    content: '# 会议纪要\n\n正文',
    ...overrides,
  });

describe('uploadDocumentToKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('打到 uploadDocument.do,带 Token 头和 multipart 表单', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ hasOk: true }));

    await upload();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/project/aiknowledge/aiknowledgebasesavev2/uploadDocument.do');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Token: 'test-token' });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('表单字段:除 knowledgeBaseId 与 attach 外都是平台默认值', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ hasOk: true }));

    await upload();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('fileType')).toBe('10');
    expect(form.get('parseMethod')).toBe('1');
    expect(form.get('visualModelCode')).toBe('');
    expect(form.get('promptWord')).toBe('');
    expect(form.get('flgExtractImage')).toBe('0');
    expect(form.get('flgContextParsing')).toBe('0');
    expect(form.get('uploadType')).toBe('knowledgeBase');
    expect(form.get('knowledgeBaseId')).toBe('kb-1');
  });

  it('attach 是笔记的 markdown,文件名带 .md', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ hasOk: true }));

    await upload({ content: '# 标题\n\n正文' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const file = (init.body as FormData).get('attach') as File;
    expect(file.name).toBe('会议纪要.md');
    expect(await file.text()).toBe('# 标题\n\n正文');
  });

  it('业务失败(hasOk: false)抛平台给的 message', async () => {
    stubFetch(async () => jsonResponse({ hasOk: false, message: '知识库容量已满' }));

    await expect(upload()).rejects.toThrow('知识库容量已满');
  });

  it('401 走 emitAuthExpired 回传给 shell', async () => {
    stubFetch(async () => jsonResponse({}, 401));

    await expect(upload()).rejects.toThrow();
    expect(emitAuthExpired).toHaveBeenCalledWith('notes');
  });
});
