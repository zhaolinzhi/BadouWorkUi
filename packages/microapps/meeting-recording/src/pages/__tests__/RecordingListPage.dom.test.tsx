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
  it('一条录音都没有时,换成设计稿的空态版式', async () => {
    ipcMocks.listMock.mockResolvedValue([]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByTestId('recording-empty-state')).toBeTruthy());
    expect(screen.getByText('录音')).toBeTruthy();
    // 空态屏的副标题与列表屏不是同一句
    expect(screen.getByText('录下讨论，整理成纪要，也可以继续向 AI 提问')).toBeTruthy();
    expect(screen.getByText('还没有录音')).toBeTruthy();
    expect(screen.getByText('点击开始，自动转写并整理纪要')).toBeTruthy();
    expect(screen.getByRole('button', { name: '开始录音' })).toBeTruthy();
    // 空态屏没有工具行、表格与底栏
    expect(screen.queryByTestId('empty-state')).toBeNull();
    expect(screen.queryByTestId('recording-search')).toBeNull();
  });

  it('空态里的「导入已有音频」置灰,「录音设置」可点开弹窗', async () => {
    ipcMocks.listMock.mockResolvedValue([]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByTestId('recording-empty-state')).toBeTruthy());
    expect((screen.getByRole('button', { name: '导入已有音频' }) as HTMLButtonElement).disabled).toBe(true);
    const settingsButton = screen.getByRole('button', { name: '录音设置' }) as HTMLButtonElement;
    expect(settingsButton.disabled).toBe(false);
    fireEvent.click(settingsButton);
    await waitFor(() => expect(screen.getByText('按需调整声音来源，确认后开始录音。')).toBeTruthy());
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

  it('搜索没匹配上时,表头保留,下面换成设计稿的空结果态', async () => {
    ipcMocks.listMock.mockResolvedValue([recording('rec-1', '周会')]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '客户回访' } });

    // 录音行没了,但表头还在 —— 设计稿的空结果态是「表头 + 下面的空态块」
    expect(screen.queryByText('周会')).toBeNull();
    expect(screen.getByText('录音名称')).toBeTruthy();

    expect(screen.getByTestId('recording-no-results')).toBeTruthy();
    expect(screen.getByText('没有找到相关录音')).toBeTruthy();
    // 说明句里带上了用户搜的关键词
    expect(screen.getByText('未找到与“客户回访”匹配的标题或转写内容')).toBeTruthy();
    expect(screen.getByTestId('recording-clear-search')).toBeTruthy();
  });

  it('有查询时搜索框旁出现清除按钮,点它把关键词清空', async () => {
    ipcMocks.listMock.mockResolvedValue([recording('rec-1', '周会')]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());

    // 没有查询 → 没有清除按钮
    expect(screen.queryByTestId('recording-search-clear')).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '客户回访' } });
    const clearButton = screen.getByTestId('recording-search-clear');
    expect(clearButton.getAttribute('aria-label')).toBe('清除录音搜索');

    fireEvent.click(clearButton);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('recording-no-results')).toBeNull();
  });

  it('空结果块里的「清空搜索」也能把关键词清空', async () => {
    ipcMocks.listMock.mockResolvedValue([recording('rec-1', '周会')]);
    render(<RecordingListPage />);
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '客户回访' } });
    fireEvent.click(screen.getByTestId('recording-clear-search'));
    await waitFor(() => expect(screen.getByText('周会')).toBeTruthy());
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });
});
