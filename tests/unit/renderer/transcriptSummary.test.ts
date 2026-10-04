/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildTranscriptSummary } from '@/renderer/components/meeting-recording/transcriptSummary';
import type { MeetingRecording, RecordingChunk } from '@/common/types/meetingRecording';

const chunk = (overrides: Partial<RecordingChunk>): RecordingChunk => ({
  index: 0,
  durationMs: 1000,
  audioUrl: '/tmp/x.webm',
  transcription: '',
  status: 'pending',
  ...overrides,
});

const rec = (chunks: RecordingChunk[]): MeetingRecording => ({
  id: 'r',
  name: 'n',
  createdAt: 0,
  mimeType: 'audio/webm',
  durationMs: chunks.reduce((s, c) => s + c.durationMs, 0),
  chunks,
});

describe('buildTranscriptSummary', () => {
  it('returns empty text and zero counts for no chunks', () => {
    expect(buildTranscriptSummary(rec([]))).toEqual({
      text: '',
      transcribedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      chunks: [],
    });
  });

  it('joins all transcribed chunks with double newline in index order', () => {
    const summary = buildTranscriptSummary(
      rec([
        chunk({ index: 0, transcription: '你好', status: 'transcribed' }),
        chunk({ index: 1, transcription: '世界', status: 'transcribed' }),
        chunk({ index: 2, transcription: '末段', status: 'transcribed' }),
      ])
    );
    expect(summary.text).toBe('你好\n\n世界\n\n末段');
    expect(summary.transcribedCount).toBe(3);
    expect(summary.failedCount).toBe(0);
    expect(summary.pendingCount).toBe(0);
  });

  it('excludes failed and pending chunks from the joined text but counts them', () => {
    const summary = buildTranscriptSummary(
      rec([
        chunk({ index: 0, transcription: '第一', status: 'transcribed' }),
        chunk({ index: 1, transcription: '', status: 'failed' }),
        chunk({ index: 2, transcription: '', status: 'pending' }),
        chunk({ index: 3, transcription: '第四', status: 'transcribed' }),
      ])
    );
    expect(summary.text).toBe('第一\n\n第四');
    expect(summary.transcribedCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
  });

  it('preserves the index order regardless of insertion order in the array', () => {
    const summary = buildTranscriptSummary(
      rec([
        chunk({ index: 2, transcription: 'C', status: 'transcribed' }),
        chunk({ index: 0, transcription: 'A', status: 'transcribed' }),
        chunk({ index: 1, transcription: 'B', status: 'transcribed' }),
      ])
    );
    expect(summary.text).toBe('A\n\nB\n\nC');
  });

  it('treats an empty transcription on a transcribed chunk as an empty segment', () => {
    const summary = buildTranscriptSummary(
      rec([
        chunk({ index: 0, transcription: '有', status: 'transcribed' }),
        chunk({ index: 1, transcription: '', status: 'transcribed' }),
        chunk({ index: 2, transcription: '尾', status: 'transcribed' }),
      ])
    );
    expect(summary.text).toBe('有\n\n\n\n尾');
    expect(summary.transcribedCount).toBe(3);
  });

  it('lists every chunk in the chunks array with its index, duration, and status', () => {
    const summary = buildTranscriptSummary(
      rec([
        chunk({ index: 0, durationMs: 1000, transcription: 'a', status: 'transcribed' }),
        chunk({ index: 1, durationMs: 2000, transcription: '', status: 'failed' }),
        chunk({ index: 2, durationMs: 3000, transcription: '', status: 'pending' }),
      ])
    );
    expect(summary.chunks).toEqual([
      { index: 0, durationMs: 1000, status: 'transcribed' },
      { index: 1, durationMs: 2000, status: 'failed' },
      { index: 2, durationMs: 3000, status: 'pending' },
    ]);
  });
});
