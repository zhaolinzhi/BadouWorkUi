/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppBootGate } from '@/renderer/components/layout/AppLoader';

afterEach(() => {
  cleanup();
});

describe('AppBootGate', () => {
  it('shows a loader instead of the app while the signed-in state is unknown', () => {
    render(
      <AppBootGate ready={false} onLoadSettings={vi.fn()}>
        <div data-testid='app' />
      </AppBootGate>
    );

    // A blank window is indistinguishable from a crash.
    expect(screen.getByTestId('app-loader-full-screen')).toBeTruthy();
    expect(screen.queryByTestId('app')).toBeNull();
  });

  it('does not load the settings before the app is ready', () => {
    const onLoadSettings = vi.fn();

    render(
      <AppBootGate ready={false} onLoadSettings={onLoadSettings}>
        <div data-testid='app' />
      </AppBootGate>
    );

    expect(onLoadSettings).not.toHaveBeenCalled();
  });

  it('renders the app as soon as it is ready, without waiting for the settings', () => {
    // The settings request goes to the backend, which after an account switch
    // is still warming up. The app must not sit behind it.
    const onLoadSettings = vi.fn(() => {
      /* never resolves in this test — the load is still in flight */
    });

    render(
      <AppBootGate ready onLoadSettings={onLoadSettings}>
        <div data-testid='app' />
      </AppBootGate>
    );

    expect(screen.getByTestId('app')).toBeTruthy();
    expect(screen.queryByTestId('app-loader-full-screen')).toBeNull();
  });

  it('starts the settings load once the app becomes ready', () => {
    const onLoadSettings = vi.fn();

    const { rerender } = render(
      <AppBootGate ready={false} onLoadSettings={onLoadSettings}>
        <div data-testid='app' />
      </AppBootGate>
    );

    expect(onLoadSettings).not.toHaveBeenCalled();

    rerender(
      <AppBootGate ready onLoadSettings={onLoadSettings}>
        <div data-testid='app' />
      </AppBootGate>
    );

    expect(onLoadSettings).toHaveBeenCalledTimes(1);
  });

  it('does not reload the settings on every render', () => {
    const onLoadSettings = vi.fn();

    const { rerender } = render(
      <AppBootGate ready onLoadSettings={onLoadSettings}>
        <div data-testid='app' />
      </AppBootGate>
    );

    rerender(
      <AppBootGate ready onLoadSettings={onLoadSettings}>
        <div data-testid='app-2' />
      </AppBootGate>
    );

    // A stable callback means the effect does not re-fire.
    expect(onLoadSettings).toHaveBeenCalledTimes(1);
  });
});
