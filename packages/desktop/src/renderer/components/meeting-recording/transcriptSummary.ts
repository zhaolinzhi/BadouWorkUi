/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import type { MeetingRecording, RecordingChunkStatus } from '@/common/types/meetingRecording';

export type TranscriptChunkMeta = {
  index: number;
  durationMs: number;
  status: RecordingChunkStatus;
};

export type TranscriptSummary = {
  /** Joined plaintext — transcribed chunks only, in original index order, `\n\n`-separated. */
  text: string;
  transcribedCount: number;
  failedCount: number;
  pendingCount: number;
  /** Per-chunk metadata for the footer summary line; includes non-transcribed chunks. */
  chunks: ReadonlyArray<TranscriptChunkMeta>;
};

/**
 * Pure: turn a `MeetingRecording` into a transcript aggregate. Side-effect free,
 * synchronous, safe to call inside `useMemo` and in unit tests.
 *
 * Order: chunks are sorted by `index` before aggregation so the joined text is
 * always in canonical chronological order, regardless of array order. The
 * per-chunk `chunks[]` metadata is also sorted by `index` so the modal
 * footer line matches.
 */
export const buildTranscriptSummary = (recording: MeetingRecording): TranscriptSummary => {
  // Sort by index — stable, never mutates the caller's array.
  const ordered = [...recording.chunks].sort((a, b) => a.index - b.index);

  const chunks: TranscriptChunkMeta[] = ordered.map((c) => ({
    index: c.index,
    durationMs: c.durationMs,
    status: c.status,
  }));

  const textSegments: string[] = [];
  let transcribedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const c of ordered) {
    if (c.status === 'transcribed') {
      textSegments.push(c.transcription);
      transcribedCount += 1;
    } else if (c.status === 'failed') {
      failedCount += 1;
    } else {
      pendingCount += 1;
    }
  }

  return {
    text: textSegments.join('\n\n'),
    transcribedCount,
    failedCount,
    pendingCount,
    chunks,
  };
};
