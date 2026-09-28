/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { ipcBridge } from '@/common';
import { createMeetingRecordingService } from '../services/meetingRecording';

// chunkTranscribed is a fire-and-forget emitter; main process only calls
// .emit() on it. No provider registration needed here.
export const registerMeetingRecordingBridge = (): void => {
  const service = createMeetingRecordingService();
  ipcBridge.meetingRecording.list.provider(() => service.list());
  ipcBridge.meetingRecording.save.provider((p) => service.save(p));
  ipcBridge.meetingRecording.delete.provider((p) => service.delete(p.id));
  ipcBridge.meetingRecording.transcribe.provider((p) => service.transcribe(p.id));
};