/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  transcribeMock: vi.fn(async () => ({ id: 'rec-1' })),
  readChunkMock: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'audio/webm' })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    meetingRecording: {
      readChunk: { invoke: mocks.readChunkMock },
      transcribe: { invoke: mocks.transcribeMock },
    },
  },
}));

import RecordingListItem from '@/renderer/components/meeting-recording/RecordingListItem';
import type { MeetingRecording, RecordingChunk } from '@/common/types/meetingRecording';

const chunk = (overrides: Partial<RecordingChunk>): RecordingChunk => ({
  index: 0,
  durationMs: 1000,
  audioUrl: '/tmp/x.webm',
  transcription: '',
  status: 'pending',
  ...overrides,
});

const makeRecording = (chunks: RecordingChunk[]): MeetingRecording => ({
  id: 'rec-1',
  name: 'Test',
  createdAt: 0,
  mimeType: 'audio/webm',
  durationMs: chunks.reduce((s, c) => s + c.durationMs, 0),
  chunks,
});

describe('RecordingListItem retry-transcribe button', () => {
  it('disables the retry button when every chunk is transcribed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, transcription: 'b', status: 'transcribed' }),
        ])}
        onDelete={() => {}}
      />
    );
    const btn = screen.getByTestId('retry-transcribe-button');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('enables the retry button when any chunk is pending', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'pending' }),
        ])}
        onDelete={() => {}}
      />
    );
    const btn = screen.getByTestId('retry-transcribe-button');
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('enables the retry button when any chunk is failed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'failed' }),
        ])}
        onDelete={() => {}}
      />
    );
    const btn = screen.getByTestId('retry-transcribe-button');
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('invokes ipcBridge.meetingRecording.transcribe with the recording id on click', async () => {
    const { default: user } = await import('@testing-library/user-event');
    const user_ = user.setup();
    mocks.transcribeMock.mockClear();
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'failed' }),
        ])}
        onDelete={() => {}}
      />
    );
    await user_.click(screen.getByTestId('retry-transcribe-button'));
    expect(mocks.transcribeMock).toHaveBeenCalledTimes(1);
    expect(mocks.transcribeMock).toHaveBeenCalledWith({ id: 'rec-1' });
  });

  it('spins the Refresh icon while any chunk is pending or failed after a click', async () => {
    const { default: user } = await import('@testing-library/user-event');
    const user_ = user.setup();
    const recording = makeRecording([
      chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
      chunk({ index: 1, status: 'failed' }),
    ]);
    const { rerender } = render(<RecordingListItem recording={recording} onDelete={() => {}} />);
    // Sanity: before the click the icon has no spin class.
    expect(screen.getByTestId('retry-transcribe-spin').className).not.toMatch(/spin/);
    await user_.click(screen.getByTestId('retry-transcribe-button'));
    // Right after the click the icon should be spinning.
    expect(screen.getByTestId('retry-transcribe-spin').className).toMatch(/spin/);
    // Simulate the main process emitting a chunkTranscribed event by
    // handing the row an updated recording where the failed chunk is now
    // still failed (e.g. upstream still down) — the spin must persist.
    rerender(<RecordingListItem recording={recording} onDelete={() => {}} />);
    expect(screen.getByTestId('retry-transcribe-spin').className).toMatch(/spin/);
    // Now simulate the chunk going through: spin must clear.
    rerender(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, transcription: 'b', status: 'transcribed' }),
        ])}
        onDelete={() => {}}
      />
    );
    expect(screen.getByTestId('retry-transcribe-spin').className).not.toMatch(/spin/);
  });
});
