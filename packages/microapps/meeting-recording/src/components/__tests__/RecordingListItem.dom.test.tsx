/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

/**
 * 记录每次 `t()` 请求的 key,断言"用的是哪个词条"时用得上。
 */
const tCalls = vi.hoisted(() => [] as string[]);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // 与 react-i18next 未初始化时的行为一致:有 defaultValue 就用它,没有就返回 key。
    // standalone(dev 直开子应用)下没有 shell 的 i18n 实例,走的正是这条分支。
    t: (k: string, opts?: Record<string, unknown>) => {
      tCalls.push(k);
      return typeof opts?.defaultValue === 'string' ? opts.defaultValue : k;
    },
  }),
}));

const ipcMocks = vi.hoisted(() => ({
  readChunkMock: vi.fn(async () => ({
    base64: Buffer.from('fake-audio').toString('base64'),
    mimeType: 'audio/webm',
  })),
}));

vi.mock('../../__qiankun__/ipc', () => ({
  ipcBridge: {
    get meetingRecording() {
      return {
        readChunk: { invoke: ipcMocks.readChunkMock },
      };
    },
  },
}));

import RecordingListItem from '../RecordingListItem';
import type { MeetingRecording } from '@common/types/meetingRecording';

const baseRecording: MeetingRecording = {
  id: 'rec-1',
  name: 'Test',
  createdAt: 1700000000000,
  mimeType: 'audio/webm',
  durationMs: 90000,
  chunks: [
    {
      index: 0,
      durationMs: 50000,
      audioUrl: '/tmp/rec-1/chunks/000.webm',
      transcription: '第一段',
      status: 'transcribed',
    },
    {
      index: 1,
      durationMs: 40000,
      audioUrl: '/tmp/rec-1/chunks/001.webm',
      transcription: '',
      status: 'pending',
    },
    {
      index: 2,
      durationMs: 30000,
      audioUrl: '/tmp/rec-1/chunks/002.webm',
      transcription: '',
      status: 'failed',
      error: 'HTTP 500',
    },
  ],
};

describe('RecordingListItem (chunked)', () => {
  beforeEach(() => {
    tCalls.length = 0;
  });

  it('renders all chunks with appropriate status text', () => {
    render(<RecordingListItem recording={baseRecording} onDelete={() => {}} />);
    expect(screen.getByText('第一段')).toBeTruthy();
    expect(screen.getByText('Transcription pending')).toBeTruthy();
    expect(screen.getByText('Transcription failed (HTTP 500)')).toBeTruthy();
  });

  it('shows chunk label with 1-based index', () => {
    render(<RecordingListItem recording={baseRecording} onDelete={() => {}} />);
    expect(screen.getByText('Chunk 1')).toBeTruthy();
    expect(screen.getByText('Chunk 3')).toBeTruthy();
    expect(tCalls).toContain('meeting-recording.chunkLabel');
  });

  it('invokes onDelete when Popconfirm OK is clicked', async () => {
    const onDelete = vi.fn();
    render(<RecordingListItem recording={baseRecording} onDelete={onDelete} />);
    const trigger = screen.getByLabelText('Delete');
    trigger.click();
    const okButton = await screen.findByText('OK');
    okButton.click();
    expect(onDelete).toHaveBeenCalledWith('rec-1');
  });

  it('toggles an inline <audio> for the clicked chunk', async () => {
    render(<RecordingListItem recording={baseRecording} onDelete={() => {}} />);
    expect(screen.queryByTestId('audio-rec-1-0')).toBeNull();
    const toggle = screen.getAllByRole('button').find((b) => b.getAttribute('aria-controls') === 'audio-rec-1-0');
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle!.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId('audio-rec-1-0')).toBeTruthy();
  });
});
