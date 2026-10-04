/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type RecordingChunkStatus = 'pending' | 'transcribed' | 'failed';

export type RecordingChunk = {
  index: number;
  durationMs: number;
  audioUrl: string;
  transcription: string;
  status: RecordingChunkStatus;
  /** Populated when status === 'failed'; surfaced in the UI for diagnosis. */
  error?: string;
  /**
   * Full JSON returned by the STT endpoint (e.g. `{ text, usage, language }`).
   * Persisted verbatim so future callers can read token counts, latency, or
   * model metadata without re-running transcription. UI displays only
   * `transcription`; this field is for storage and downstream consumers.
   */
  raw?: unknown;
};

export type MeetingRecording = {
  id: string;
  name: string;
  createdAt: number;
  mimeType: string;
  durationMs: number;
  chunks: RecordingChunk[];
};

export type SaveRecordingChunkPayload = {
  index: number;
  durationMs: number;
  audioBase64: string;
};

export type SaveRecordingParams = {
  id: string;
  name: string;
  mimeType: string;
  chunks: SaveRecordingChunkPayload[];
};
