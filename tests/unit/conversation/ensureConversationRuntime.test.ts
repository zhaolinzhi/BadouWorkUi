/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AcpConfigOptionDto, EnsureConversationRuntimeResponse } from '@/common/types/platform/acpTypes';

// Mock the IPC bridge BEFORE importing the module under test.
const ensureRuntimeMock = vi.fn<(req: { conversation_id: string }) => Promise<EnsureConversationRuntimeResponse>>();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      ensureRuntime: { invoke: ensureRuntimeMock },
    },
  },
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

afterEach(() => {
  ensureRuntimeMock.mockReset();
  vi.resetModules();
});

describe('ensureConversationRuntime dedup', () => {
  it('concurrent callers share one IPC round-trip', async () => {
    ensureRuntimeMock.mockResolvedValue(ensureRuntimeResponse());

    const { ensureConversationRuntime, resetEnsureConversationRuntimeStateForTests } =
      await import('@/renderer/pages/conversation/utils/ensureConversationRuntime');

    const a = ensureConversationRuntime('conv-dedup-1');
    const b = ensureConversationRuntime('conv-dedup-1');
    const c = ensureConversationRuntime('conv-dedup-1');

    const [first, second, third] = await Promise.all([a, b, c]);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(1);

    resetEnsureConversationRuntimeStateForTests();
    await ensureConversationRuntime('conv-dedup-1');
    expect(ensureRuntimeMock).toHaveBeenCalledTimes(2);
  });
});
