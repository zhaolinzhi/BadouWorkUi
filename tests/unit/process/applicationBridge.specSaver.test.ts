/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const providerHandlerRef: { current: ((params: { token: string; taskId: string }) => Promise<void>) | null } = {
  current: null,
};

vi.mock('@/common', () => ({
  ipcBridge: {
    env: {
      setSpecSaverToken: {
        provider: (handler: (params: { token: string; taskId: string }) => Promise<void>) => {
          providerHandlerRef.current = handler;
        },
      },
    },
  },
}));

// Mock the heavy top-level side effects of applicationBridge.ts so that
// importing it only evaluates our small SPEC_SAVER_TOKEN function.
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '', getVersion: () => '', getName: () => '' },
  session: { defaultSession: { clear: () => undefined } },
}));
vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: { get: vi.fn() },
}));
vi.mock('@process/utils/zoom', () => ({
  getZoomFactor: () => 1,
  setZoomFactor: () => undefined,
}));
vi.mock('@process/utils/configureChromium', () => ({
  getCdpStatus: () => ({}),
  updateCdpConfig: () => undefined,
}));
vi.mock('@process/utils/cdpBridgeRegistry', () => ({
  getCdpBridgeHandle: () => null,
}));
vi.mock('@process/utils/gpuRecovery', () => ({
  getGpuStatus: () => ({}),
  setGpuUserOverride: () => undefined,
}));
vi.mock('./applicationBridgeCore', () => ({
  initApplicationBridgeCore: () => undefined,
}));
vi.mock('./restartApplication', () => ({
  restartApplication: () => undefined,
}));
vi.mock('@/common/config/constants', () => ({
  BROWSER_SESSION_PARTITION: 'persist:partition',
}));

import {
  registerSpecSaverTokenEnv,
  SPEC_SAVER_TOKEN_ENV,
  SPEC_SAVER_TASK_ID_ENV,
} from '@/process/bridge/applicationBridge';

describe('applicationBridge env provider (SPEC_SAVER_TOKEN)', () => {
  beforeEach(() => {
    providerHandlerRef.current = null;
    delete process.env[SPEC_SAVER_TOKEN_ENV];
    delete process.env[SPEC_SAVER_TASK_ID_ENV];
  });
  afterEach(() => {
    delete process.env[SPEC_SAVER_TOKEN_ENV];
    delete process.env[SPEC_SAVER_TASK_ID_ENV];
  });

  it('exports the canonical env var names', () => {
    expect(SPEC_SAVER_TOKEN_ENV).toBe('SPEC_SAVER_TOKEN');
    expect(SPEC_SAVER_TASK_ID_ENV).toBe('SPEC_SAVER_TASK_ID');
  });

  it('registers a provider on ipcBridge.env.setSpecSaverToken', () => {
    registerSpecSaverTokenEnv();
    expect(typeof providerHandlerRef.current).toBe('function');
  });

  it('writes both env vars when the provider handler runs', async () => {
    registerSpecSaverTokenEnv();
    const handler = providerHandlerRef.current;
    expect(handler).not.toBeNull();
    await handler!({ token: 'tok-abc', taskId: '42' });
    expect(process.env[SPEC_SAVER_TOKEN_ENV]).toBe('tok-abc');
    expect(process.env[SPEC_SAVER_TASK_ID_ENV]).toBe('42');
  });

  it('allows overwriting with an empty token', async () => {
    registerSpecSaverTokenEnv();
    const handler = providerHandlerRef.current!;
    await handler({ token: 'first', taskId: '1' });
    await handler({ token: '', taskId: '2' });
    expect(process.env[SPEC_SAVER_TOKEN_ENV]).toBe('');
    expect(process.env[SPEC_SAVER_TASK_ID_ENV]).toBe('2');
  });

  it('overwrites on subsequent invocations', async () => {
    registerSpecSaverTokenEnv();
    const handler = providerHandlerRef.current!;
    await handler({ token: 'a', taskId: '10' });
    await handler({ token: 'b', taskId: '20' });
    expect(process.env[SPEC_SAVER_TOKEN_ENV]).toBe('b');
    expect(process.env[SPEC_SAVER_TASK_ID_ENV]).toBe('20');
  });
});
