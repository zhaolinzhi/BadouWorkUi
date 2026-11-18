/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库详情页（产品设计资料页）：标题区、文档列表、加载更多、搜索、空/错态。
 *
 * 用真实的 `useKnowledgeBaseDocuments` + stub 掉的 fetch 跑，页面与数据层
 * 的接线一起验。
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { shellNavigate } = vi.hoisted(() => ({ shellNavigate: vi.fn() }));

beforeEach(() => {
  // Arco 组件在挂载时会读 window.matchMedia，jsdom 没有，得自己补。
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@icon-park/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@icon-park/react')>()),
  MoreOne: () => null,
}));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'test-token', navigate: shellNavigate }),
}));

const { default: KnowledgeBaseDetailPage } = await import('../KnowledgeBaseDetailPage');

const DOC_URL_FRAGMENT = 'mdCode=view_knowledge_relevancy';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const docRow = (id: string, name: string) => ({
  id,
  name,
  flgType: 'md',
  fileType: '10',
  processedTaskNum: '268',
  updateTime: '2026-11-17 15:09:47.0',
  createTime: '2026-11-17',
});

// 模块级共用对象：用例里不要直接改它的属性，需要变体时用 { ...runtime } 造新的。
const runtime = {
  personalItems: [{ id: 'kb-1', name: '产品设计资料', isShared: false, documentCount: 3 }],
  sharedItems: [],
  personalLoading: false,
  personalError: null,
  sharedLoading: false,
  sharedError: null,
  listLoaded: true,
  onRetryLoadPersonal: vi.fn(),
  onRetryLoadShared: vi.fn(),
  onRefresh: vi.fn(),
  onDelete: vi.fn(),
  onOpenEdit: vi.fn(),
  onCreate: vi.fn(),
  onStartChat: vi.fn(),
};

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/kb/kb-1']}>
      <Routes>
        <Route path='/kb/:knowledgeBaseId' element={<KnowledgeBaseDetailPage runtime={runtime} />} />
      </Routes>
    </MemoryRouter>
  );

describe('KnowledgeBaseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('渲染库名、副标题与文档行', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'AppIcon.md')] }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-document-d1')).toBeTruthy());

    expect(screen.getByTestId('kb-detail-title').textContent).toBe('产品设计资料');
    expect(screen.getByTestId('kb-detail-subtitle').textContent).toBe('个人知识库 · 仅自己可见');
    expect(screen.getByTestId('kb-document-d1').textContent).toContain('AppIcon.md');
    expect(screen.getByTestId('kb-document-d1').textContent).toContain('MD');
    expect(screen.getByTestId('kb-document-d1').textContent).toContain('268 条数据');
    expect(screen.getByTestId('kb-detail-count').textContent).toBe('内容 (1)');
  });

  it('文档更新时间只显示到分钟（空格分隔与带 T 的 ISO 形式都兼容）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          Total: 2,
          Rows: [
            { ...docRow('d1', 'space.md'), updateTime: '2026-11-17 15:09:47.0' },
            { ...docRow('d2', 'iso.md'), updateTime: '2025-08-29T12:18:03' },
          ],
        })
      )
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-document-d1')).toBeTruthy());
    const row1 = screen.getByTestId('kb-document-d1').textContent ?? '';
    const row2 = screen.getByTestId('kb-document-d2').textContent ?? '';
    expect(row1).toContain('2026-11-17 15:09');
    expect(row1).not.toContain('15:09:47');
    expect(row2).toContain('2025-08-29 12:18');
    expect(row2).not.toContain('12:18:03');
  });

  it('文档行展示创建时间与「更多」按钮', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          Total: 1,
          // 创建时间给一个与更新时间不同的值，避免断言互相串台
          Rows: [{ ...docRow('d1', 'AppIcon.md'), createTime: '2025-12-01' }],
        })
      )
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-document-d1')).toBeTruthy());

    const row = screen.getByTestId('kb-document-d1');
    expect(row.textContent).toContain('2026-11-17 15:09');
    expect(row.textContent).toContain('2025-12-01');

    // 行内的「更多」按钮（默认透明，悬浮时显现 —— 那部分是 CSS）
    const more = screen.getByTestId('kb-document-more-d1');
    expect(more).toBeTruthy();
    expect(more.getAttribute('aria-label')).toContain('AppIcon.md');
  });

  it('共享知识库的副标题是「共享知识库 · 团队共享」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );

    render(
      <MemoryRouter initialEntries={['/kb/kb-shared']}>
        <Routes>
          <Route
            path='/kb/:knowledgeBaseId'
            element={
              <KnowledgeBaseDetailPage
                runtime={{
                  ...runtime,
                  personalItems: [],
                  sharedItems: [{ id: 'kb-shared', name: '团队知识库', isShared: true }],
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId('kb-detail-subtitle')).toBeTruthy());
    expect(screen.getByTestId('kb-detail-subtitle').textContent).toBe('共享知识库 · 团队共享');
  });

  it('空列表显示空态文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('empty-state-title')).toBeTruthy());
    expect(screen.getByTestId('empty-state-title').textContent).toBe('这个知识库还没有文档');
  });

  it('接口失败显示错误态与重试按钮', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-detail-error')).toBeTruthy());
    expect(screen.getByTestId('kb-detail-error').textContent).toContain('加载文档失败');
    expect(screen.getByTestId('async-boundary-retry')).toBeTruthy();
  });

  it('请求带上当前知识库 id', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ Total: 0, Rows: [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    renderDetail();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(DOC_URL_FRAGMENT);
    const body = new URLSearchParams(String(init?.body ?? ''));
    expect(JSON.parse(body.get('defaultSearchParam') ?? '[]')).toEqual([
      { name: 'knowledgeBaseId', value: 'kb-1', type: 'exact-match' },
    ]);
  });

  it('底部「加载更多」加载下一页并追加行', async () => {
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        return jsonResponse({ Total: 2, Rows: [docRow(`d${call}`, `doc-${call}.md`)] });
      })
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-document-d1')).toBeTruthy());
    expect(screen.getByTestId('kb-detail-load-more')).toBeTruthy();

    fireEvent.click(screen.getByTestId('kb-detail-load-more'));

    await waitFor(() => expect(screen.getByTestId('kb-document-d2')).toBeTruthy());
    expect(screen.getByTestId('kb-document-d1')).toBeTruthy();
  });

  it('全部加载完显示「没有更多内容了」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 1, Rows: [docRow('d1', 'doc-1.md')] }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-document-d1')).toBeTruthy());
    expect(screen.getByTestId('kb-detail-end')).toBeTruthy();
    expect(screen.getByTestId('kb-detail-end').textContent).toBe('没有更多内容了');
    expect(screen.queryByTestId('kb-detail-load-more')).toBeNull();
  });

  it('点放大镜展开搜索框，输入后按文件名查询', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ Total: 0, Rows: [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    renderDetail();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('kb-detail-search-toggle'));

    const input = screen.getByTestId('kb-detail-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '设计' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 3000 });

    const [, searchInit] = fetchMock.mock.calls[1];
    const body = new URLSearchParams(String(searchInit?.body ?? ''));
    expect(JSON.parse(body.get('searchParam') ?? '[]')).toEqual([
      { name: 'name', value: '设计', type: 'text-query', tagName: '' },
    ]);
  });

  it('搜索无结果显示「暂无搜索结果」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('empty-state-title')).toBeTruthy());

    fireEvent.click(screen.getByTestId('kb-detail-search-toggle'));
    const input = screen.getByTestId('kb-detail-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '不存在的文档' } });

    await waitFor(() => expect(screen.getByTestId('kb-detail-count').textContent).toBe('搜索结果 (0)'), {
      timeout: 3000,
    });
    expect(screen.getByTestId('empty-state-title').textContent).toBe('暂无搜索结果');
  });

  it('「问知识库」跳到 shell 的 /kb-chat/:id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('kb-detail-ask')).toBeTruthy());
    fireEvent.click(screen.getByTestId('kb-detail-ask'));

    expect(shellNavigate).toHaveBeenCalledWith('/kb-chat/kb-1');
  });

  it('个人知识库有「更多」菜单，共享知识库没有', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );

    renderDetail();
    await waitFor(() => expect(screen.getByTestId('kb-detail-more')).toBeTruthy());

    render(
      <MemoryRouter initialEntries={['/kb/kb-shared']}>
        <Routes>
          <Route
            path='/kb/:knowledgeBaseId'
            element={
              <KnowledgeBaseDetailPage
                runtime={{
                  ...runtime,
                  personalItems: [],
                  sharedItems: [{ id: 'kb-shared', name: '团队知识库', isShared: true }],
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByTestId('kb-detail-ask').length).toBe(2));
    expect(screen.getAllByTestId('kb-detail-more').length).toBe(1);
  });
});
