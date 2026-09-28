/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type MeetingRecording = {
  id: string;
  name: string;
  createdAt: number;
  durationMs: number;
  mimeType: string;
  audioUrl: string;
  transcription: string;
};

export type SaveRecordingParams = {
  id: string;
  name: string;
  mimeType: string;
  durationMs: number;
  audioBase64: string;
};