/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

vi.mock('../../hooks/useRecordingName', () => ({
  useRecordingName: () => ({
    buildDefaultName: () => '录音 · 10月26日 10:24',
  }),
}));

import RecordingEmptyState from '../RecordingEmptyState';
import type { MeetingRecorder } from '../../components/RecorderPanel';

const createRecorder = (overrides: Partial<MeetingRecorder> = {}): MeetingRecorder =>
  ({
    status: 'idle',
    durationMs: 0,
    errorCode: undefined,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => undefined),
    reset: vi.fn(),
    ...overrides,
  }) as MeetingRecorder;

describe('RecordingEmptyState', () => {
  it('渲染标题、描述与默认输入提示', () => {
    render(<RecordingEmptyState recorder={createRecorder()} />);
    expect(screen.getByText('还没有录音')).toBeTruthy();
    expect(screen.getByText('点击开始，自动转写并整理纪要')).toBeTruthy();
    expect(screen.getByText('默认麦克风 · 中文普通话')).toBeTruthy();
  });

  it('「导入已有音频」尚未上线,置灰不可点', () => {
    render(<RecordingEmptyState recorder={createRecorder()} />);
    expect((screen.getByRole('button', { name: '导入已有音频' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('「开始录音」是可用的录音入口', () => {
    render(<RecordingEmptyState recorder={createRecorder()} />);
    expect((screen.getByRole('button', { name: '开始录音' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('「录音设置」打开设置弹窗,确认后用弹窗里的名字开始录音', async () => {
    const recorder = createRecorder();
    render(<RecordingEmptyState recorder={recorder} />);

    // 「录音设置」可点 —— 不再置灰
    const settingsButton = screen.getByRole('button', { name: '录音设置' }) as HTMLButtonElement;
    expect(settingsButton.disabled).toBe(false);
    fireEvent.click(settingsButton);

    // 弹窗出现
    await waitFor(() => expect(screen.getByText('按需调整声音来源，确认后开始录音。')).toBeTruthy());
    // 展开「更多设置」后可以改名字
    fireEvent.click(screen.getByRole('button', { name: '更多设置' }));
    const nameInput = screen.getByLabelText('录音名称（选填）') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '周会录音' } });

    // 弹窗里的「开始录音」用 testid 定位 —— 页面上还有面板的同名按钮
    fireEvent.click(screen.getByTestId('recording-settings-start'));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledWith({ name: '周会录音' }));
  });
});
