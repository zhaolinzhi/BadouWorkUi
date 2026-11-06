/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * `t` 必须稳定引用:页面里的 `refresh` 以 `t` 为依赖,`t` 每次渲染都换新的话
 * `refresh` 也会换新 → useEffect 反复触发 → 列表被反复重置。
 */
const i18nMocks = vi.hoisted(() => ({
  t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // 有 defaultValue 就用它,没有就返回 key —— 与 react-i18next 未初始化时的行为一致。
    t: i18nMocks.t,
  }),
}));

const ipcMocks = vi.hoisted(() => ({
  listMock: vi.fn(async () => [] as unknown[]),
}));

vi.mock('../../__qiankun__/ipc', () => ({
  ipcBridge: {
    get meetingRecording() {
      return {
        list: { invoke: ipcMocks.listMock },
        chunkTranscribed: { on: () => () => {} },
      };
    },
  },
}));

vi.mock('../../hooks/useMeetingRecorder', () => ({
  useMeetingRecorder: () => ({
    status: 'idle' as const,
    durationMs: 0,
    errorCode: undefined,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => undefined),
    reset: vi.fn(),
  }),
}));

import RecordingListPage from '../RecordingListPage';
import type { MeetingRecording } from '@common/types/meetingRecording';

const recording = (id: string, name: string, transcription = ''): MeetingRecording =>
  ({
    id,
    name,
    createdAt: Date.now(),
    mimeType: 'audio/webm',
    durationMs: 60000,
    chunks: [{ index: 0, durationMs: 60000, audioUrl: '/tmp/x.webm', transcription, status: 'pending' }],
  }) as unknown as MeetingRecording;

describe('RecordingListPage', () => {
  it('渲染页头标题、副标题与录音按钮', async () => {
    ipcMocks.listMock.mockResolvedValue([]);
    render(<RecordingListPage />);
    expect(screen.getByText('录音')).toBeTruthy();
    expect(screen.getByText('录音、转写与纪要集中管理，点击记录即可查看')).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始录音' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('empty-state')).toBeTruthy());
  });

  it('tab 上显示录音条数,底栏显示同步状态', async () => {
    ipcMocks.listMock.mockResolvedValue([recording('rec-1', '周会')]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());
    expect(screen.getByText('全部录音 1')).toBeTruthy();
    expect(screen.getByText('1 条录音 · 已同步')).toBeTruthy();
  });

  it('搜索框按标题过滤列表', async () => {
    ipcMocks.listMock.mockResolvedValue([recording('rec-1', '周会'), recording('rec-2', '客户访谈')]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '客户' } });
    expect(screen.queryByText('周会')).toBeNull();
    expect(screen.getByText('客户访谈')).toBeTruthy();
  });
});
