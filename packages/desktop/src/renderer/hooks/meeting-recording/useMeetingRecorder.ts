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
  // We keep every per-50s `dataavailable` slice as a separate chunk and
  // pass them to the main process as `chunks[]`. The main process's
  // STT walker (meetingRecording/index.ts) calls `transcribeFile` once
  // per chunk, and `sttClient.ts`'s `repairWebmChunk` borrows the EBML
  // header from chunk #0 so every later chunk is a self-decodable webm
  // stream when sent upstream.
  //
  // We store the *promise* from `event.data.arrayBuffer()` rather than
  // `.then(push)`-ing the resolved value. The reason is a race that
  // surfaced with short recordings (<50s, single slice) where
  // MediaRecorder fires `dataavailable` *during* `stop()` — if we
  // asynchronously push resolved buffers via `.then()`, the `stop` event
  // can fire before the `arrayBuffer()` Promise resolves, leaving
  // `chunksRef.current` empty when `stop()` reads the array. The result
  // would be a 0-byte webm file on disk, which the upstream STT endpoint
  // rejects with HTTP 400 "Invalid or unsupported audio file". Awaiting
  // every pending promise in `stop()` closes that window. Long
  // recordings (>50s) trigger `dataavailable` periodically via the
  // 50_000 timeslice, each slice is queued as a pending promise, and
  // `Promise.all` joins them at stop() time.
  const chunksRef = useRef<Promise<ArrayBuffer>[]>([]);
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
      if (event.data.size === 0) return;
      // Store the promise itself, not a `.then(...)` push. The promise
      // resolves asynchronously inside the browser's Blob implementation;
      // if we awaited each one inside this callback the next timeslice
      // (or the synchronous `stop` event) could be delayed. Collecting
      // promises lets us fan out all the reads and join them at stop().
      chunksRef.current.push(event.data.arrayBuffer());
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
      // Wait for every queued `arrayBuffer()` Promise to resolve before
      // reading the array. `await stopped` only guarantees the `stop`
      // event fired, not that the bytes from the trailing
      // `dataavailable` slice have been copied out of the Blob. Without
      // this fan-in, short recordings (<50s, single slice) can race and
      // leave `chunksRef.current` empty — which would surface as a
      // 0-byte webm file on disk, rejected upstream with HTTP 400
      // "Invalid or unsupported audio file".
      const buffers = await Promise.all(chunksRef.current);
      // We pass each per-50s slice as its own chunk to the main process.
      // Slice #0 is a self-contained webm (EBML + Segment + Tracks +
      // cluster #0); later slices are bare clusters — the main process
      // reuses slice #0's EBML header to make them decodable before
      // sending each to the STT endpoint (see sttClient.ts
      // `repairWebmChunk`).
      const perChunkDuration = Math.round(recordedDurationMs / Math.max(1, buffers.length));
      const chunksPayload = await Promise.all(
        buffers.map(async (buf, index) => ({
          index,
          durationMs: perChunkDuration,
          audioBase64: await blobToBase64(new Blob([buf], { type: effectiveMimeType })),
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
