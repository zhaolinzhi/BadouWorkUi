/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type {
  AcpConfigOptionDto,
  EnsureConversationRuntimeResponse,
  SetConfigOptionResponse,
} from '@/common/types/platform/acpTypes';

// Mock the IPC bridge BEFORE importing the module under test.
const ensureRuntimeMock = vi.fn<(req: { conversation_id: string }) => Promise<EnsureConversationRuntimeResponse>>();
const setConfigOptionMock =
  vi.fn<(req: { conversation_id: string; option_id: string; value: string }) => Promise<SetConfigOptionResponse>>();

// SWR will subscribe to a global event-emitter on the mock if present; the
// hooks we test only call the IPC bridge, so a plain shape is enough.
vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      ensureRuntime: { invoke: ensureRuntimeMock },
    },
    acpConversation: {
      setConfigOption: { invoke: setConfigOptionMock },
      // The hook also subscribes to the response stream for agent_status
      // events. Return an unsubscribe function so the effect tears down cleanly.
      responseStream: { on: () => () => {} },
    },
  },
}));

// Mock the perf logger so the hook doesn't try to talk to the IPC transport.
vi.mock('@/renderer/utils/perf', () => ({
  perfEnabled: () => false,
  perfLogger: { log: () => {}, flush: () => {}, dispose: () => {} },
  mark: () => {},
  perfTime: <T>(_entry: unknown, fn: () => T): T => fn(),
  perfTimeAsync: async <T>(_entry: unknown, fn: () => Promise<T>): Promise<T> => fn(),
}));

const sampleOptions: AcpConfigOptionDto[] = [
  {
    id: 'model',
    category: 'model',
    option_type: 'select',
    current_value: 'gpt-5.5',
    options: [
      { value: 'gpt-5.5', name: 'GPT-5.5' },
      { value: 'gpt-5.4', name: 'GPT-5.4' },
    ],
  },
];

const ensureRuntimeResponse = (): EnsureConversationRuntimeResponse => ({
  recovered: false,
  config_options: sampleOptions,
  runtime: {
    state: 'ready',
    agent_id: 'agent-1',
    backend: 'claude',
    session_id: 'session-1',
    last_error: null,
  },
});

const setConfigOptionResponse = (value: string): SetConfigOptionResponse => ({
  confirmation: 'observed',
  config_options: [
    {
      ...sampleOptions[0],
      current_value: value,
    },
  ],
});

afterEach(() => {
  ensureRuntimeMock.mockReset();
  setConfigOptionMock.mockReset();
  vi.resetModules();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

describe('useAcpConfigOptions.setConfigOption dedup', () => {
  it('does not re-warm the agent on a second setConfigOption within the TTL', async () => {
    ensureRuntimeMock.mockResolvedValue(ensureRuntimeResponse());
    setConfigOptionMock.mockImplementation(async (req) => setConfigOptionResponse(req.value));

    const { useAcpConfigOptions, forgetEnsuredConversation } =
      await import('@/renderer/hooks/agent/useAcpConfigOptions');

    const { result } = renderHook(() =>
      useAcpConfigOptions({
        conversation_id: 'conv-switch-1',
        prepareRuntime: undefined,
        prepareSetRuntime: undefined,
      })
    );

    // Let the mount-time reload effect resolve.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(1);

    // First user click — within TTL so the pre-fetch is skipped.
    await act(async () => {
      await result.current.setConfigOption('model', 'gpt-5.4');
    });
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(1);
    expect(setConfigOptionMock).toHaveBeenCalledTimes(1);

    // Second user click within TTL — still no extra ensureRuntime.
    await act(async () => {
      await result.current.setConfigOption('model', 'gpt-5.5');
    });
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(1);
    expect(setConfigOptionMock).toHaveBeenCalledTimes(2);

    // Advance past the TTL and click again — must re-warm.
    await act(async () => {
      vi.advanceTimersByTime(6_000);
    });

    await act(async () => {
      await result.current.setConfigOption('model', 'gpt-5.4');
    });
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(2);

    // forgetEnsuredConversation forces the next click to re-warm
    // immediately, regardless of TTL. Rewind the clock to "inside TTL"
    // first to prove the forget wins over the cache.
    await act(async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      forgetEnsuredConversation('conv-switch-1');
      await result.current.setConfigOption('model', 'gpt-5.5');
    });
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(3);
  });
});
