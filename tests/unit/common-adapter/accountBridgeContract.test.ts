/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { ipcBridge } from '@/common';

describe('account ipc contract', () => {
  it('exposes setActive / clearActive / getActive providers', () => {
    expect(typeof ipcBridge.account.setActive.provider).toBe('function');
    expect(typeof ipcBridge.account.clearActive.provider).toBe('function');
    expect(typeof ipcBridge.account.getActive.provider).toBe('function');
  });

  it('exposes a portChanged emitter', () => {
    expect(typeof ipcBridge.account.portChanged.on).toBe('function');
    expect(typeof ipcBridge.account.portChanged.emit).toBe('function');
  });
});
