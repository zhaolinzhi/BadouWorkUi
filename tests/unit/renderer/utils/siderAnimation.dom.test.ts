/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';

import { isSiderAnimating, SIDER_ANIMATING_CLASS, SIDER_ANIMATION_WINDOW_MS } from '@/renderer/utils/ui/siderAnimation';

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
});
