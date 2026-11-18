/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isSiderAnimating,
  notifySiderAnimationEnd,
  onSiderAnimationEnd,
  SIDER_ANIMATING_CLASS,
  SIDER_ANIMATION_WINDOW_MS,
} from '@/renderer/utils/ui/siderAnimation';

describe('siderAnimation', () => {
  afterEach(() => {
    document.body.classList.remove(SIDER_ANIMATING_CLASS);
  });

  it('reports not animating without the body class', () => {
    expect(isSiderAnimating()).toBe(false);
  });

  it('follows the body class flag', () => {
    document.body.classList.add(SIDER_ANIMATING_CLASS);
    expect(isSiderAnimating()).toBe(true);

    document.body.classList.remove(SIDER_ANIMATING_CLASS);
    expect(isSiderAnimating()).toBe(false);
  });

  it('window covers the 0.2s Arco width transition', () => {
    expect(SIDER_ANIMATION_WINDOW_MS).toBeGreaterThanOrEqual(200);
  });

  it('keeps the subscription alive across transitions', () => {
    // A subscriber usually registers long before the next transition starts
    // (e.g. when the message list mounts). A one-shot subscription would be
    // gone by the time the event fires and the deferred measurement lost.
    const listener = vi.fn();
    const unsubscribe = onSiderAnimationEnd(listener);

    notifySiderAnimationEnd();
    notifySiderAnimationEnd();

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    notifySiderAnimationEnd();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
