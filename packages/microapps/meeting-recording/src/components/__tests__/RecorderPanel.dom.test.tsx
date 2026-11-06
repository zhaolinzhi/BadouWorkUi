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
    // 与 react-i18next 未初始化时的行为一致:有 defaultValue 就用它,没有就返回 key。
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

vi.mock('../../__qiankun__/ipc', () => ({
  ipcBridge: {
    get meetingRecording() {
      return {} as Record<string, never>;
    },
  },
}));

const recorderState = vi.hoisted(() => ({
  status: 'idle' as 'idle' | 'requesting' | 'recording' | 'finalizing' | 'error',
  durationMs: 0,
}));

vi.mock('../../hooks/useMeetingRecorder', () => ({
  useMeetingRecorder: () => ({
    status: recorderState.status,
    durationMs: recorderState.durationMs,
    errorCode: undefined,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => undefined),
    reset: vi.fn(),
  }),
}));

import RecorderPanel from '../RecorderPanel';

describe('RecorderPanel', () => {
  it('renders a button labelled 开始录音 in idle state', () => {
    render(<RecorderPanel />);
    const button = screen.getByRole('button', { name: '开始录音' });
    expect(button).toBeTruthy();
  });

  it('renders a 停止 button and the elapsed timer while recording', () => {
    recorderState.status = 'recording';
    recorderState.durationMs = 65000;
    render(<RecorderPanel />);
    expect(screen.getByRole('button', { name: '停止' })).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy();
    recorderState.status = 'idle';
    recorderState.durationMs = 0;
  });
});
