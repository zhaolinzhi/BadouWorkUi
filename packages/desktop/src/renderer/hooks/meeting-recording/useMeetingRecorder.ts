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
  // We collect raw bytes (ArrayBuffer) instead of Blob[] because the recorder's
  // `timeslice` mode emits per-50s `dataavailable` slices that are NOT
  // independently playable webm files — only the first slice carries the
  // EBML header / Segment / Tracks. The later slices are bare clusters with
  // no container, so any player (browser <audio>, QuickTime, VLC) rejects
  // them as "format error". To produce a single playable webm, we collect
  // every slice's bytes and concatenate them at stop() time.
  //
  // We deliberately store the *promise* from `event.data.arrayBuffer()`
  // rather than `.then(push)`-ing the resolved value. The reason is a
  // race that surfaced with short recordings (<50s) where MediaRecorder
  // fires `dataavailable` *during* `stop()` — if we asynchronously push
  // resolved buffers via `.then()`, the `stop` event can fire before the
  // `arrayBuffer()` Promise resolves, leaving `chunksRef.current` empty
  // when `stop()` synthesizes the final Blob. The result is a 0-byte
  // webm file on disk, which the upstream STT endpoint rejects with
  // HTTP 400 "Invalid or unsupported audio file". Awaiting every pending
  // promise before concatenating closes that window.
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
      // concatenating. `await stopped` only guarantees the `stop` event
      // fired, not that the bytes from the trailing `dataavailable`
      // slice have been copied out of the Blob. Without this fan-in,
      // short recordings (<50s, single slice) can race and produce an
      // empty Blob — which the upstream STT endpoint rejects with HTTP
      // 400 "Invalid or unsupported audio file".
      const buffers = await Promise.all(chunksRef.current);
      // Concatenate all collected bytes into a single webm container. The
      // recorder's first slice carries the EBML/Segment/Tracks header, so
      // the resulting blob is a self-contained, playable file. We expose
      // it to the main process as a single chunk (index 0) — the main
      // process doesn't care how many slices the recorder produced.
      const combined = new Blob(buffers as BlobPart[], { type: effectiveMimeType });
      const chunksPayload = [
        {
          index: 0,
          durationMs: recordedDurationMs,
          audioBase64: await blobToBase64(combined),
        },
      ];
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
