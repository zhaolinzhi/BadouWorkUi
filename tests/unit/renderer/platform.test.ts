/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getChromeLikeUserAgent } from '@/renderer/utils/platform';

describe('getChromeLikeUserAgent', () => {
  it('strips the Electron token from a typical Electron UA', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.91 Electron/30.5.1 Safari/537.36';
    const result = getChromeLikeUserAgent(ua);
    expect(result).not.toContain('Electron');
    expect(result).toContain('Chrome/130.0.6723.91');
    expect(result).toContain('Safari/537.36');
  });

  it('handles a UA without an Electron token (returns unchanged)', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    expect(getChromeLikeUserAgent(ua)).toBe(ua);
  });

  it('handles lowercase electron token case-insensitively', () => {
    const ua = 'Mozilla/5.0 Chrome/130.0.0.0 electron/30.5.1 Safari/537.36';
    expect(getChromeLikeUserAgent(ua)).not.toContain('electron');
  });

  it('does not drop the token suffix incorrectly (keeps other product tokens)', () => {
    const ua = 'Mozilla/5.0 X11; Linux Chrome/130.0.0.0 Electron/30.5.1 AionUi/1.0.0 Safari/537.36';
    const result = getChromeLikeUserAgent(ua);
    expect(result).not.toContain('Electron/30.5.1');
    expect(result).toContain('AionUi/1.0.0');
  });
});
