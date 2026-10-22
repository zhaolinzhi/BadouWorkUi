/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * micro-app → main process IPC bridge accessor.
 *
 * qiankun 2.x wraps the microapp's `window` in a Proxy that does NOT expose
 * host-installed globals (notably `window.ipcBridge`, which the shell installs
 * via `renderer/micro-app/services/expose-ipc-bridge.ts` before
 * `loadMicroApp`). Naive `window.ipcBridge.meetingRecording.list.invoke()`
 * therefore resolves to undefined inside the sandbox. The fix is to bypass the
 * proxy by reaching the *real* global window via indirect eval —
 * `(0, eval)('window')` is the only form of eval that runs in the global scope
 * (rather than the caller's), and so is the only way qiankun can't intercept.
 *
 * The same `(0, eval)('window')` pattern is used by `qiankunHeadModuleShim` in
 * vite.config.ts to expose `$RefreshReg$` to the React Refresh runtime; see
 * that file's long comment for the full explanation of why indirect eval
 * escapes the sandbox proxy.
 *
 * The static `require('@/common')` fallback is kept so the test suite
 * (`vi.mock('@/common', ...)`) still works: under vitest, the indirect-eval
 * branch returns undefined (jsdom has no real ipcBridge), so we fall through
 * to the module-level require — which the mock has replaced.
 */
import type {
  MeetingRecording,
  RecordingChunk,
  RecordingChunkStatus,
  SaveRecordingChunkPayload,
  SaveRecordingParams,
} from '@common/types/meetingRecording';

type InvokeFn<TParams, TResult> = (params: TParams) => Promise<TResult>;
type OnFn<TPayload> = (handler: (payload: TPayload) => void) => () => void;

export interface MeetingRecordingBridge {
  list: { invoke: InvokeFn<void, MeetingRecording[]> };
  save: { invoke: InvokeFn<SaveRecordingParams, MeetingRecording> };
  delete: { invoke: InvokeFn<{ id: string }, { ok: true }> };
  transcribe: { invoke: InvokeFn<{ id: string }, { id: string }> };
  cancelTranscribe: { invoke: InvokeFn<{ id: string }, { ok: true }> };
  readChunk: {
    invoke: InvokeFn<{ id: string; chunkIndex: number }, { base64: string; mimeType: string }>;
  };
  chunkTranscribed: {
    on: OnFn<{
      id: string;
      chunkIndex: number;
      status: 'transcribed' | 'failed';
      transcription?: string;
      error?: string;
    }>;
  };
}

/**
 * Resolve the real global window, bypassing qiankun's proxy.
 * Indirect eval is the only form of eval that runs in the global scope and
 * thus is the only form qiankun can't intercept.
 */
function getRealWindow(): Window & typeof globalThis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (0, eval)('window') as any;
}

/**
 * Resolve the meetingRecording bridge once, then cache it. Order:
 *
 *   1. indirect-eval `window.ipcBridge.meetingRecording` (Electron + qiankun path)
 *   2. static require from '@/common' (vitest path where the test mocks that module)
 *   3. throw with a precise diagnostic — micro-app only works in Electron or under test
 */
let cached: MeetingRecordingBridge | null = null;

export function getMeetingRecordingBridge(): MeetingRecordingBridge {
  if (cached) return cached;

  // Path 1: real-window lookup (Electron + qiankun).
  try {
    const realWindow = getRealWindow();
    const bridge = (realWindow as unknown as { ipcBridge?: { meetingRecording?: MeetingRecordingBridge } }).ipcBridge
      ?.meetingRecording;
    if (bridge && typeof bridge.list?.invoke === 'function') {
      cached = bridge;
      return cached;
    }
  } catch {
    // Indirect eval can fail in environments that lock down CSP `unsafe-eval`
    // (e.g. some hardened WebUI deployments). Fall through to the static require.
  }

  // Path 2: static require — vitest `vi.mock('@/common', ...)` swaps this out.
  // Using `require` (sync) instead of dynamic `import` (async) so callers can
  // `await`-free access the bridge. The mock module is already resolved by
  // the time this function runs.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const commonModule = require('@/common') as { ipcBridge?: { meetingRecording?: MeetingRecordingBridge } };
  const bridge = commonModule.ipcBridge?.meetingRecording;
  if (bridge && typeof bridge.list?.invoke === 'function') {
    cached = bridge;
    return cached;
  }

  throw new Error(
    '[meeting-recording microapp] ipcBridge.meetingRecording is unavailable. ' +
      'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
  );
}

/**
 * Convenience accessor mirroring the static-import shape. Property access
 * (`ipcBridge.meetingRecording.list.invoke(...)`) is preserved through the
 * getter so callers don't need to know about the resolver function.
 */
export const ipcBridge = {
  get meetingRecording(): MeetingRecordingBridge {
    return getMeetingRecordingBridge();
  },
};

// Re-export types so callers can `import type { MeetingRecording } from '.../ipc'`
// instead of reaching into @common/types/meetingRecording directly.
export type { MeetingRecording, RecordingChunk, RecordingChunkStatus, SaveRecordingChunkPayload, SaveRecordingParams };
