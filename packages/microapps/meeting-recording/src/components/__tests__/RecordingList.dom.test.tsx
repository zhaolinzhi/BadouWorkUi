/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 录音列表接入共享 `AsyncBoundary` / `EmptyState` 的回归测试。
 *
 * 迁移前这里是「加载中转圈 / 空列表一行纯文本 / 有数据就渲染列表」的三段手写
 * 判断。接入共享层之后,状态分支各有稳定 testid:
 *
 *   1. 加载中只渲染 loading 分支,列表内容不露出来。
 *   2. 空列表渲染共享层的 `EmptyState`(有图标 + 标题),而不是一行纯文本。
 *   3. 有录音时渲染列表。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

// 行组件带着 IPC 与弹窗依赖,本组断言只关心列表层的三态,换掉更干净。
vi.mock('../RecordingListItem', () => ({
  default: ({ recording }: { recording: { id: string; name: string } }) => (
    <div data-testid={`recording-${recording.id}`}>{recording.name}</div>
  ),
}));

import RecordingList from '../RecordingList';
import type { MeetingRecording } from '@common/types/meetingRecording';

const recording = {
  id: 'rec-1',
  name: '周会录音',
} as unknown as MeetingRecording;

describe('RecordingList 接入 AsyncBoundary', () => {
  it('加载中渲染 loading 分支,不渲染列表', () => {
    render(<RecordingList recordings={[recording]} loading onDelete={vi.fn()} />);

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
    expect(screen.queryByTestId('recording-rec-1')).toBeNull();
  });

  it('没有录音时渲染共享层的 EmptyState', () => {
    render(<RecordingList recordings={[]} loading={false} onDelete={vi.fn()} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByTestId('empty-state-title').textContent).toBe('No recordings yet');
  });

  it('有录音时渲染列表,不渲染空态', () => {
    render(<RecordingList recordings={[recording]} loading={false} onDelete={vi.fn()} />);

    expect(screen.getByTestId('recording-rec-1')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });
});
