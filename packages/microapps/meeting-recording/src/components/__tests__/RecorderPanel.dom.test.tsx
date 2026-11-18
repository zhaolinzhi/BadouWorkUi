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

import RecorderPanel from '../RecorderPanel';
import type { MeetingRecorder } from '../RecorderPanel';

/** 造一个可控的录音机 —— 面板是受控组件,自己不再创建录音机。 */
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

describe('RecorderPanel', () => {
  it('renders a button labelled 开始录音 in idle state', () => {
    render(<RecorderPanel recorder={createRecorder()} />);
    const button = screen.getByRole('button', { name: '开始录音' });
    expect(button).toBeTruthy();
  });

  it('renders a 停止 button and the elapsed timer while recording', () => {
    render(
      <RecorderPanel
        recorder={createRecorder({
          status: 'recording',
          durationMs: 65000,
        })}
      />
    );
    expect(screen.getByRole('button', { name: '停止' })).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy();
  });

  it('点击「开始录音」调用页面持有的录音机', () => {
    const recorder = createRecorder();
    render(<RecorderPanel recorder={recorder} />);
    screen.getByRole('button', { name: '开始录音' }).click();
    expect(recorder.start).toHaveBeenCalled();
  });
});
