/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';
import type { MeetingRecording, SaveRecordingParams } from '@/common/types/meetingRecording';
import { pickRecordingMimeType } from '@renderer/hooks/system/useSpeechInput';

export type MeetingRecorderStatus = 'idle' | 'requesting' | 'recording' | 'finalizing' | 'error';

export type MeetingRecorderErrorCode =
  | 'permission-denied'
  | 'no-device'
  | 'recording-unsupported'
  | 'save-failed'
  | 'unknown';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

const mapStartError = (error: unknown): MeetingRecorderErrorCode => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'permission-denied';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'no-device';
  }
  return 'unknown';
};

const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleString();

export const useMeetingRecorder = () => {
  const [status, setStatus] = useState<MeetingRecorderStatus>('idle');
  const [errorCode, setErrorCode] = useState<MeetingRecorderErrorCode | undefined>(undefined);
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const mimeTypeRef = useRef<string>('');

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return;
    setErrorCode(undefined);
    setDurationMs(0);
    setStatus('requesting');

    const mimeType = pickRecordingMimeType();
    if (!mimeType) {
      setErrorCode('recording-unsupported');
      setStatus('error');
      return;
    }
    mimeTypeRef.current = mimeType;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setErrorCode(mapStartError(error));
      setStatus('error');
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      setErrorCode(mapStartError(error));
      setStatus('error');
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = performance.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.start(50_000); // ≤50 s per chunk
    setStatus('recording');
  }, [status]);

  const stop = useCallback(async (): Promise<MeetingRecording | undefined> => {
    const recorder = recorderRef.current;
    const stream = streamRef.current;
    if (!recorder || recorder.state !== 'recording') return undefined;
    setStatus('finalizing');

    const stoppedAt = performance.now();
    const recordedDurationMs = Math.max(0, Math.round(stoppedAt - startedAtRef.current));

    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });
    recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    await stopped;

    const effectiveMimeType = recorder.mimeType || mimeTypeRef.current || 'audio/webm';

    let saved: MeetingRecording;
    try {
      const perChunkDuration = Math.round(recordedDurationMs / Math.max(1, chunksRef.current.length));
      const chunksPayload = await Promise.all(
        chunksRef.current.map(async (chunk, index) => ({
          index,
          durationMs: perChunkDuration,
          audioBase64: await blobToBase64(chunk),
        }))
      );
      const id = crypto.randomUUID();
      const params: SaveRecordingParams = {
        id,
        name: formatDate(Date.now()),
        mimeType: effectiveMimeType,
        chunks: chunksPayload,
      };
      saved = await ipcBridge.meetingRecording.save.invoke(params);
      void ipcBridge.meetingRecording.transcribe.invoke({ id });
    } catch {
      setErrorCode('save-failed');
      setStatus('error');
      return undefined;
    }

    recorderRef.current = null;
    streamRef.current = null;
    setStatus('idle');
    setDurationMs(0);
    return saved;
  }, []);

  useEffect(() => {
    if (status !== 'recording') return;
    let frame = 0;
    const tick = () => {
      setDurationMs(Math.max(0, Math.round(performance.now() - startedAtRef.current)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  const reset = useCallback(() => {
    setErrorCode(undefined);
    setDurationMs(0);
    setStatus('idle');
  }, []);

  return { status, durationMs, errorCode, start, stop, reset };
};
