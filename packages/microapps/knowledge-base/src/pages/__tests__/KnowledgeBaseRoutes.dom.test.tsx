/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库路由：卡片点击进详情页、详情页返回首页。
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';

const { shellNavigate } = vi.hoisted(() => ({ shellNavigate: vi.fn() }));

beforeEach(() => {
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

// 详情页渲染期会读 shell 注入的运行时（token / navigate），与详情页测试同一套 mock。
vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'test-token', navigate: shellNavigate }),
}));

const { createRouter, KnowledgeBaseRuntimeProvider } = await import('../KnowledgeBaseRoutes');

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const personalItems = [
  { id: 'p-1', name: '产品设计资料', isShared: false, documentCount: 4, updatedAt: '2026-10-20' },
  { id: 'p-2', name: '项目交接文档', isShared: false, documentCount: 2, updatedAt: '2026-10-18' },
];

const runtime = {
  personalItems,
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

describe('知识库路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 详情页挂载即请求文档列表，stub 成空列表避免噪音与未捕获请求。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ Total: 0, Rows: [] }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('点击卡片进入详情页路由，不再跳外链', () => {
    const router = createRouter('/');
    render(
      <KnowledgeBaseRuntimeProvider value={runtime}>
        <RouterProvider router={router} />
      </KnowledgeBaseRuntimeProvider>
    );

    expect(router.state.location.pathname).toBe('/');

    fireEvent.click(screen.getByTestId('kb-card-p-1'));

    expect(router.state.location.pathname).toBe('/kb/p-1');
  });

  it('详情页在知识库被删除后回到首页', async () => {
    const router = createRouter('/');
    const { rerender } = render(
      <KnowledgeBaseRuntimeProvider value={runtime}>
        <RouterProvider router={router} />
      </KnowledgeBaseRuntimeProvider>
    );

    fireEvent.click(screen.getByTestId('kb-card-p-1'));
    expect(router.state.location.pathname).toBe('/kb/p-1');

    rerender(
      <KnowledgeBaseRuntimeProvider value={{ ...runtime, personalItems: [], listLoaded: true }}>
        <RouterProvider router={router} />
      </KnowledgeBaseRuntimeProvider>
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});
