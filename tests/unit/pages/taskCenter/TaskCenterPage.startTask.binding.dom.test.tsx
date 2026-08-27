/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'u1', token: 'tok' },
    status: 'authenticated',
    completeExternalLogin: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    notifyTokenExpired: vi.fn(),
  }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/renderer/api/projectBinding', () => ({
  getProjectBinding: vi.fn().mockResolvedValue(null),
  saveProjectBinding: vi.fn(),
  clearProjectBinding: vi.fn(),
}));

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

const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify({ Total: 1, Rows: [sampleRow] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
);
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  navigateMock.mockReset();
  fetchMock.mockClear();
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const { default: TaskCenterPage } = await import('@/renderer/pages/task-center');

describe('TaskCenterPage — binding context on start task', () => {
  it('开始任务时 navigate 携带 projectId + projectName + requireBinding', async () => {
    render(
      <MemoryRouter>
        <TaskCenterPage />
      </MemoryRouter>
    );

    const card = await screen.findByTestId('task-card-1');
    fireEvent.click(card);

    const startBtn = await screen.findByTestId('task-detail-start');
    fireEvent.click(startBtn);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).toHaveBeenCalledWith(
      '/guid',
      expect.objectContaining({
        state: expect.objectContaining({
          projectId: expect.any(String),
          projectName: expect.any(String),
          requireBinding: true,
        }),
      })
    );
  });
});
