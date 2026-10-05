/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const fakeState: { state: 'inactive' | 'recording' } = { state: 'inactive' };

  const fakeRecorder = {
    start: vi.fn(() => {
      fakeState.state = 'recording';
      fakeRecorder.state = 'recording';
    }),
    stop: vi.fn(() => {
      fakeState.state = 'inactive';
      fakeRecorder.state = 'inactive';
      // Emulate the real MediaRecorder behavior: dataavailable + stop fire
      // asynchronously after stop() returns. queueMicrotask mirrors that.
      queueMicrotask(() => {
        fakeRecorder.ondataavailable?.({ data: new Blob(['x']) });
        for (const listener of fakeRecorder._stopListeners) listener();
      });
    }),
    mimeType: 'audio/webm',
    state: 'inactive' as 'inactive' | 'recording',
    _stopListeners: new Set<() => void>(),
    addEventListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'stop') fakeRecorder._stopListeners.add(listener);
    }),
    ondataavailable: undefined as ((e: { data: Blob }) => void) | undefined,
    onstop: undefined as (() => void) | undefined,
  };

  class FakeMediaRecorder {
    constructor(
      public stream: MediaStream,
      _opts: MediaRecorderOptions
    ) {
      // The recorder starts in 'inactive' state; the test's start() mock flips
      // it to 'recording'. The constructor must NOT clobber that flip after
      // the hook has called start() — only reset bookkeeping between tests.
      return fakeRecorder as unknown as FakeMediaRecorder;
    }
    static isTypeSupported = () => true;
  }

  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = vi.fn(async () => stream);

  const ipcMock = {
    meetingRecording: {
      save: { invoke: vi.fn() },
      transcribe: { invoke: vi.fn() },
    },
  };

  return { fakeState, fakeRecorder, FakeMediaRecorder, track, stream, getUserMedia, ipcMock };
});

vi.mock('@renderer/hooks/system/useSpeechInput', () => ({
  pickRecordingMimeType: () => 'audio/webm',
}));

vi.mock('@/common', () => ({ ipcBridge: mocks.ipcMock }));

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: { getUserMedia: mocks.getUserMedia },
  configurable: true,
});

// @ts-expect-error - test double
globalThis.MediaRecorder = mocks.FakeMediaRecorder;

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => 'uuid-1' },
  configurable: true,
});

import { useMeetingRecorder } from '@/renderer/hooks/meeting-recording/useMeetingRecorder';

beforeEach(() => {
  mocks.fakeState.state = 'inactive';
  mocks.fakeRecorder.state = 'inactive';
  mocks.fakeRecorder._stopListeners.clear();
  mocks.fakeRecorder.ondataavailable = undefined;
  mocks.fakeRecorder.onstop = undefined;
  mocks.fakeRecorder.start.mockClear();
  mocks.fakeRecorder.stop.mockClear();
  mocks.fakeRecorder.addEventListener.mockClear();
  mocks.track.stop.mockClear();
  mocks.getUserMedia.mockClear();
  mocks.ipcMock.meetingRecording.save.invoke.mockReset();
  mocks.ipcMock.meetingRecording.transcribe.invoke.mockReset();
  mocks.ipcMock.meetingRecording.save.invoke.mockResolvedValue({
    id: 'uuid-1',
    name: 'r',
    createdAt: 0,
    durationMs: 1000,
    mimeType: 'audio/webm',
    chunks: [
      {
        index: 0,
        durationMs: 1000,
        audioUrl: '/tmp/uuid-1/chunks/000.webm',
        transcription: '',
        status: 'pending',
      },
    ],
  });
  mocks.ipcMock.meetingRecording.transcribe.invoke.mockResolvedValue({ id: 'uuid-1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMeetingRecorder', () => {
  it('saves chunks + fires transcribe without blocking on transcription', async () => {
    const { result } = renderHook(() => useMeetingRecorder());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('recording');

    let saved: { id: string; chunks: { index: number }[] } | undefined;
    await act(async () => {
      saved = await result.current.stop();
    });
    // Drain pending microtasks (FileReader + IPC invoke are async).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.status).toBe('idle');
    expect(saved?.id).toBe('uuid-1');
    expect(saved?.chunks.length).toBeGreaterThanOrEqual(1);

    expect(mocks.ipcMock.meetingRecording.save.invoke).toHaveBeenCalledTimes(1);
    const saveArg = mocks.ipcMock.meetingRecording.save.invoke.mock.calls[0][0];
    expect(Array.isArray(saveArg.chunks)).toBe(true);
    expect(saveArg.chunks.length).toBeGreaterThanOrEqual(1);

    expect(mocks.ipcMock.meetingRecording.transcribe.invoke).toHaveBeenCalledTimes(1);
    expect(mocks.ipcMock.meetingRecording.transcribe.invoke).toHaveBeenCalledWith({ id: 'uuid-1' });
  });

  it('surfaces permission errors as error status', async () => {
    mocks.getUserMedia.mockRejectedValueOnce(Object.assign(new DOMException('denied', 'NotAllowedError'), {}));
    const { result } = renderHook(() => useMeetingRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('permission-denied');
  });
});
