/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notifyTokenExpiredMock = vi.fn();
let streamErrorHandler: ((p: unknown) => void) | undefined;
let streamEndHandler: ((p: unknown) => void) | undefined;
let streamChunkHandler: ((p: unknown) => void) | undefined;

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    notifyTokenExpired: notifyTokenExpiredMock,
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    kbChat: {
      send: { invoke: vi.fn() },
      abort: { invoke: vi.fn() },
      streamChunk: {
        on: (handler: unknown) => {
          streamChunkHandler = handler as (p: unknown) => void;
          return () => undefined;
        },
      },
      streamError: {
        on: (handler: unknown) => {
          streamErrorHandler = handler as (p: unknown) => void;
          return () => undefined;
        },
      },
      streamEnd: {
        on: (handler: unknown) => {
          streamEndHandler = handler as (p: unknown) => void;
          return () => undefined;
        },
      },
    },
  },
}));

const { useKbChat } = await import('@/renderer/hooks/kb-chat/useKbChat');

beforeEach(() => {
  notifyTokenExpiredMock.mockReset();
  streamErrorHandler = undefined;
  streamEndHandler = undefined;
  streamChunkHandler = undefined;
});

describe('useKbChat — token expired', () => {
  it('calls notifyTokenExpired(kb-chat) when streamError code is token_expired', async () => {
    // Generate a stable UUID so we know which requestId the hook will use.
    let generatedId: string | undefined;
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        ...realCrypto,
        randomUUID: () => {
          generatedId = 'r-stable';
          return 'r-stable';
        },
      },
    });

    const { result } = renderHook(() => useKbChat({ kbId: 'k1', token: 'tok' }));

    vi.mocked((await import('@/common')).ipcBridge.kbChat.send.invoke).mockResolvedValue({
      requestId: 'r-stable',
      ok: true,
    });

    await act(async () => {
      await result.current.send('hello');
    });

    expect(generatedId).toBe('r-stable');

    act(() => {
      streamErrorHandler?.({ requestId: 'r-stable', code: 'token_expired', message: 'Empty SSE stream' });
    });

    expect(notifyTokenExpiredMock).toHaveBeenCalledWith('kb-chat');

    // Restore crypto
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: realCrypto });
  });

  it('does NOT call notifyTokenExpired when streamError code is not token_expired', async () => {
    const realCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { ...realCrypto, randomUUID: () => 'r-stable-2' },
    });

    const { result } = renderHook(() => useKbChat({ kbId: 'k1', token: 'tok' }));

    vi.mocked((await import('@/common')).ipcBridge.kbChat.send.invoke).mockResolvedValue({
      requestId: 'r-stable-2',
      ok: true,
    });

    await act(async () => {
      await result.current.send('hi');
    });

    act(() => {
      streamErrorHandler?.({ requestId: 'r-stable-2', code: 'incomplete', message: 'Stream ended without done event' });
    });

    expect(notifyTokenExpiredMock).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: realCrypto });
  });
});
