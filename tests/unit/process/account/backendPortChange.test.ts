/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

const { portChanged } = vi.hoisted(() => ({
  portChanged: vi.fn(),
}));

vi.mock('@/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common')>();
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      account: {
        ...actual.ipcBridge.account,
        portChanged: { emit: portChanged },
      },
    },
  };
});

import { publishBackendPort } from '@/process/account/backendPortChange';

describe('publishBackendPort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
  });

  it('publishes the new port to the main process and the renderer', () => {
    publishBackendPort(45678);

    expect((globalThis as typeof globalThis & { __backendPort?: number }).__backendPort).toBe(45678);
    expect(portChanged).toHaveBeenCalledWith({ backendPort: 45678 });
  });

  it('republishes when the backend moves to another port', () => {
    publishBackendPort(45678);
    publishBackendPort(45679);

    expect((globalThis as typeof globalThis & { __backendPort?: number }).__backendPort).toBe(45679);
    expect(portChanged).toHaveBeenCalledTimes(2);
    expect(portChanged).toHaveBeenLastCalledWith({ backendPort: 45679 });
  });

  it('ignores an invalid port', () => {
    publishBackendPort(0);

    expect((globalThis as typeof globalThis & { __backendPort?: number }).__backendPort).toBeUndefined();
    expect(portChanged).not.toHaveBeenCalled();
  });
});
