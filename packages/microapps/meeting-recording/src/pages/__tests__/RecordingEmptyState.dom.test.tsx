/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
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

import RecordingEmptyState from '../RecordingEmptyState';

describe('RecordingEmptyState', () => {
  it('渲染标题、描述与默认输入提示', () => {
    render(<RecordingEmptyState />);
    expect(screen.getByText('还没有录音')).toBeTruthy();
    expect(screen.getByText('点击开始，自动转写并整理纪要')).toBeTruthy();
    expect(screen.getByText('默认麦克风 · 中文普通话')).toBeTruthy();
  });

  it('「导入已有音频」与「录音设置」尚未上线,置灰不可点', () => {
    render(<RecordingEmptyState />);
    expect((screen.getByRole('button', { name: '导入已有音频' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '录音设置' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('「开始录音」是可用的录音入口', () => {
    render(<RecordingEmptyState />);
    expect((screen.getByRole('button', { name: '开始录音' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
