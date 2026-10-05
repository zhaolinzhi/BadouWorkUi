/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    meetingRecording: {
      readChunk: {
        invoke: vi.fn(async () => ({
          base64: Buffer.from('fake-audio').toString('base64'),
          mimeType: 'audio/webm',
        })),
      },
    },
  },
}));

import RecordingListItem from '@/renderer/components/meeting-recording/RecordingListItem';
import type { MeetingRecording } from '@/common/types/meetingRecording';

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
  it('renders all chunks with appropriate status text', () => {
    render(<RecordingListItem recording={baseRecording} onDelete={() => {}} />);
    expect(screen.getByText('第一段')).toBeTruthy();
    expect(screen.getByText('meeting-recording.transcriptionPending')).toBeTruthy();
    expect(screen.getByText('meeting-recording.transcriptionFailed (HTTP 500)')).toBeTruthy();
  });

  it('shows chunk label with 1-based index', () => {
    render(<RecordingListItem recording={baseRecording} onDelete={() => {}} />);
    expect(screen.getByText('meeting-recording.chunkLabel:{"index":1}')).toBeTruthy();
    expect(screen.getByText('meeting-recording.chunkLabel:{"index":3}')).toBeTruthy();
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
