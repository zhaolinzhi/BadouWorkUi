/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    auth: {
      startExternalLogin: { provider: vi.fn() },
      claimPending: { provider: vi.fn() },
      externalLoginCompleted: { emit },
    },
  },
}));

import { claimPendingExternalLogin, handleExternalLoginDeepLink } from '@/process/auth/externalLoginManager';

const VALID_PARAMS = {
  token: 'tok-123',
  userId: 'u1',
  username: 'Alice',
};

describe('external login deep-link payload', () => {
  beforeEach(() => {
    emit.mockReset();
    // Drain anything a previous case left pending.
    claimPendingExternalLogin();
  });

  it('emits the payload to the renderer', () => {
    const result = handleExternalLoginDeepLink(VALID_PARAMS);

    expect(result.ok).toBe(true);
    expect(emit).toHaveBeenCalledWith({
      token: 'tok-123',
      user: { id: 'u1', username: 'Alice' },
    });
  });

  it('holds the payload so a renderer that was not listening yet can claim it', () => {
    // The deep link is delivered straight through IPC with no buffering. If
    // the login page has not mounted yet, the emitted event goes nowhere and
    // the user is stuck on the login page with a valid token.
    handleExternalLoginDeepLink(VALID_PARAMS);

    expect(claimPendingExternalLogin()).toEqual({
      token: 'tok-123',
      user: { id: 'u1', username: 'Alice' },
    });
  });

  it('hands the payload out only once', () => {
    // A login page that remounts must not replay an already-consumed token.
    handleExternalLoginDeepLink(VALID_PARAMS);

    expect(claimPendingExternalLogin()).not.toBeNull();
    expect(claimPendingExternalLogin()).toBeNull();
  });

  it('keeps the newest payload', () => {
    handleExternalLoginDeepLink(VALID_PARAMS);
    handleExternalLoginDeepLink({ token: 'tok-456', userId: 'u2', username: 'Bob' });

    expect(claimPendingExternalLogin()?.token).toBe('tok-456');
  });

  it('holds nothing when the payload is invalid', () => {
    const result = handleExternalLoginDeepLink({ token: '', userId: 'u1', username: 'Alice' });

    expect(result.ok).toBe(false);
    expect(emit).not.toHaveBeenCalled();
    expect(claimPendingExternalLogin()).toBeNull();
  });
});
