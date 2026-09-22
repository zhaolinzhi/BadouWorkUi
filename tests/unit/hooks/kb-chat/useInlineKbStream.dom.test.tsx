/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chunkListeners: Array<(p: { requestId: string; content: string }) => void> = [];
const endListeners: Array<(p: { requestId: string; reason: 'done' | 'aborted' | 'error' }) => void> = [];
const errorListeners: Array<(p: { requestId: string; code: string; message: string }) => void> = [];
const notifyTokenExpired = vi.fn();

vi.mock('@/common', () => {
  return {
    ipcBridge: {
      kbChat: {
        send: { invoke: vi.fn() },
        abort: { invoke: vi.fn() },
        streamChunk: {
          on: vi.fn((cb: unknown) => {
            chunkListeners.push(cb as never);
            return () => undefined;
          }),
        },
        streamEnd: {
          on: vi.fn((cb: unknown) => {
            endListeners.push(cb as never);
            return () => undefined;
          }),
        },
        streamError: {
          on: vi.fn((cb: unknown) => {
            errorListeners.push(cb as never);
            return () => undefined;
          }),
        },
      },
    },
    KbChatStreamErrorCode: {} as never,
  };
});

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ notifyTokenExpired, user: { token: 'tok-1' } }),
}));

// Note: relative import from the package the hook lives in, via path alias.
import { useInlineKbStream } from '@renderer/hooks/kb-chat/useInlineKbStream';

const emitChunk = (requestId: string, content: string): void => {
  for (const cb of chunkListeners) cb({ requestId, content });
};
const emitEnd = (requestId: string, reason: 'done' | 'aborted' | 'error'): void => {
  for (const cb of endListeners) cb({ requestId, reason });
};
const emitError = (requestId: string, code: string, message: string): void => {
  for (const cb of errorListeners) cb({ requestId, code, message });
};

const clearListeners = (): void => {
  chunkListeners.length = 0;
  endListeners.length = 0;
  errorListeners.length = 0;
};

describe('useInlineKbStream', () => {
  beforeEach(() => {
    clearListeners();
    notifyTokenExpired.mockReset();
    vi.clearAllMocks();
  });
  afterEach(clearListeners);

  it('streams chunks and finishes done', async () => {
    const { result } = renderHook(() =>
      useInlineKbStream({
        conversationId: 'c1',
        kbId: '42',
        name: 'Docs',
        isShared: false,
      })
    );
    await act(async () => {
      await result.current.send('what is X?');
    });
    const lastCallArg = vi.mocked((await import('@/common')).ipcBridge.kbChat.send.invoke).mock.calls.at(-1)?.[0] as {
      kbId: string;
      question: string;
      token: string;
      requestId: string;
    };
    expect(lastCallArg).toMatchObject({ kbId: '42', question: 'what is X?', token: 'tok-1' });

    act(() => {
      emitChunk(lastCallArg.requestId, 'hello ');
      emitChunk(lastCallArg.requestId, 'world');
      emitEnd(lastCallArg.requestId, 'done');
    });
    expect(result.current.content).toBe('hello world');
    expect(result.current.status).toBe('done');
  });

  it('records errors and notifies on token_expired', async () => {
    const { result } = renderHook(() =>
      useInlineKbStream({ conversationId: 'c1', kbId: '42', name: 'Docs', isShared: false })
    );
    await act(async () => {
      await result.current.send('q');
    });
    const invoke = vi.mocked((await import('@/common')).ipcBridge.kbChat.send.invoke);
    const lastArg = invoke.mock.calls.at(-1)?.[0] as { requestId: string };
    const requestId = lastArg.requestId;
    act(() => {
      emitChunk(requestId, 'partial');
      emitError(requestId, 'token_expired', 'expired');
      emitEnd(requestId, 'error');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.content).toBe('partial');
    expect(result.current.error).toEqual({ code: 'token_expired', message: 'expired' });
    expect(notifyTokenExpired).toHaveBeenCalledWith('kb-chat');
  });

  it('aborts and marks aborted', async () => {
    const { result } = renderHook(() =>
      useInlineKbStream({ conversationId: 'c1', kbId: '42', name: 'Docs', isShared: false })
    );
    await act(async () => {
      await result.current.send('q');
    });
    const invoke = vi.mocked((await import('@/common')).ipcBridge.kbChat.send.invoke);
    const lastArg = invoke.mock.calls.at(-1)?.[0] as { requestId: string };
    const requestId = lastArg.requestId;
    act(() => result.current.abort());
    const abortInvoke = vi.mocked((await import('@/common')).ipcBridge.kbChat.abort.invoke);
    expect(abortInvoke).toHaveBeenCalledWith({ requestId });
    act(() => emitEnd(requestId, 'aborted'));
    expect(result.current.status).toBe('aborted');
  });

  it('errors early when no token', async () => {
    vi.doMock('@/renderer/hooks/context/AuthContext', () => ({
      useAuth: () => ({ notifyTokenExpired: vi.fn(), user: null }),
    }));
    vi.resetModules();
    const mod = await import('@renderer/hooks/kb-chat/useInlineKbStream');
    const { result } = renderHook(() =>
      mod.useInlineKbStream({ conversationId: 'c1', kbId: '42', name: 'Docs', isShared: false })
    );
    await act(async () => {
      await result.current.send('q');
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('no_token');
  });
});
