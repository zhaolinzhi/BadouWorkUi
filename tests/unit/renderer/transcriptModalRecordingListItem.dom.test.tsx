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
      readChunk: { invoke: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'audio/webm' })) },
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

describe('RecordingListItem transcript button', () => {
  it('disables the transcript button when no chunk is transcribed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([chunk({ index: 0, status: 'pending' }), chunk({ index: 1, status: 'failed' })])}
        onDelete={() => {}}
      />
    );
    const btn = screen.getByTestId('transcript-view-button');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('enables the transcript button when at least one chunk is transcribed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([chunk({ index: 0, transcription: 'hi', status: 'transcribed' })])}
        onDelete={() => {}}
      />
    );
    const btn = screen.getByTestId('transcript-view-button');
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('opens the transcript modal on click', async () => {
    render(
      <RecordingListItem
        recording={makeRecording([chunk({ index: 0, transcription: 'hi', status: 'transcribed' })])}
        onDelete={() => {}}
      />
    );
    expect(screen.queryByText('Test')).toBeTruthy();
    await act(async () => {
      screen.getByTestId('transcript-view-button').click();
    });
    // Modal renders the recording name as title — it should now appear twice.
    expect(screen.getAllByText('Test').length).toBeGreaterThanOrEqual(2);
  });
});
