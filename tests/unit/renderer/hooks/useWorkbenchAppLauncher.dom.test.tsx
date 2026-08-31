/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks so the (hoisted) vi.mock factories can reference them safely.
const { useAuthMock, isElectronMock, mockOpenExternalUrl, mockMessageWarning, mockMessageError } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  isElectronMock: { value: true },
  mockOpenExternalUrl: vi.fn(),
  mockMessageWarning: vi.fn(),
  mockMessageError: vi.fn(),
}));

// PreviewProvider pulls ipcBridge (WS-backed emitters + fs IO). Stub the same
// surface previewContext.dom.test.tsx stubs so the provider mounts cleanly in
// jsdom; only the openBrowserTab path is exercised here.
vi.mock('@/common', () => ({
  ipcBridge: {
    fileStream: { contentUpdate: { on: () => () => {} } },
    preview: { open: { on: () => () => {} } },
    fs: {
      writeFile: { invoke: async () => true },
      getFileMetadata: { invoke: async () => null },
      readFile: { invoke: async () => null },
      getImageBase64: { invoke: async () => null },
    },
  },
}));

// Use the exact same module specifiers the hook imports so the mocks match.
vi.mock('@renderer/hooks/context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@renderer/utils/platform', () => ({
  isElectronDesktop: () => isElectronMock.value,
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    warning: (...args: unknown[]) => mockMessageWarning(...args),
    error: (...args: unknown[]) => mockMessageError(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  PreviewProvider,
  usePreviewContext,
  type PreviewContextValue,
} from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import { useWorkbenchAppLauncher } from '@/renderer/pages/workbench/useWorkbenchAppLauncher';
import type { WorkbenchApp } from '@/renderer/pages/workbench/apps';

interface ProbeHandle {
  launcher: ReturnType<typeof useWorkbenchAppLauncher> | null;
}

let handle: ProbeHandle;
let ctx: PreviewContextValue;

const Probe: React.FC = () => {
  handle.launcher = useWorkbenchAppLauncher();
  ctx = usePreviewContext();
  return null;
};

const mount = (): void => {
  handle = { launcher: null };
  render(
    <PreviewProvider>
      <Probe />
    </PreviewProvider>
  );
};

const APP_WITH_EXTRA: WorkbenchApp = {
  id: 'badou-cloud',
  name: '八斗云',
  url: 'http://pm.badousoft.com/center',
  extraParams: { tenant: 'badou', source: 'workbench' },
};

const APP_PLAIN: WorkbenchApp = {
  id: 'ksp',
  name: 'KSP',
  url: 'http://ksp.badousoft.com/',
};

/** Launch through the live hook and flush pending state updates. */
const launch = async (app: WorkbenchApp): Promise<void> => {
  await act(async () => {
    await handle.launcher?.launch(app);
  });
};

/** Latest tab's content (URL for browser tabs). */
const lastTabContent = (): string => ctx.tabs[ctx.tabs.length - 1].content;

beforeEach(() => {
  localStorage.clear();
  useAuthMock.mockReset();
  isElectronMock.value = true;
  mockOpenExternalUrl.mockReset();
  mockMessageWarning.mockReset();
  mockMessageError.mockReset();
  useAuthMock.mockReturnValue({
    user: { id: 'u1', username: 'alice', token: 'token-123' },
    status: 'authenticated',
  });
});

afterEach(() => {
  cleanup();
});

describe('useWorkbenchAppLauncher (Electron)', () => {
  it('returns a launch function', () => {
    mount();
    expect(typeof handle.launcher?.launch).toBe('function');
  });

  it('warns and returns early when no token is present', async () => {
    useAuthMock.mockReturnValue({ user: null, status: 'authenticated' });
    mount();
    await launch(APP_PLAIN);
    expect(mockMessageWarning).toHaveBeenCalledTimes(1);
    // No new tab was opened.
    expect(ctx.tabs).toHaveLength(0);
  });

  it('builds URL with extraParams + Token and opens a browser tab', async () => {
    mount();
    await launch(APP_WITH_EXTRA);
    expect(ctx.tabs).toHaveLength(1);
    expect(ctx.tabs[0].content_type).toBe('browser');
    const url = lastTabContent();
    expect(url).toContain('http://pm.badousoft.com/center');
    expect(url).toContain('tenant=badou');
    expect(url).toContain('source=workbench');
    expect(url).toContain('Token=token-123');
  });

  it('injects only Token when extraParams is undefined', async () => {
    mount();
    await launch(APP_PLAIN);
    const url = lastTabContent();
    expect(url).toContain('http://ksp.badousoft.com/');
    expect(url).toContain('Token=token-123');
    expect(url).not.toContain('tenant=');
  });

  it('surfaces error via Message.error when URL construction throws', async () => {
    mount();
    const before = ctx.tabs.length;
    await launch({ id: 'bad', name: 'Bad', url: 'http://[invalid-url' });
    expect(mockMessageError).toHaveBeenCalledTimes(1);
    expect(ctx.tabs).toHaveLength(before);
  });

  it('does not fall back to openExternalUrl on Electron', async () => {
    mount();
    await launch(APP_PLAIN);
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });
});

describe('useWorkbenchAppLauncher (WebUI fallback)', () => {
  it('routes to openExternalUrl when not Electron and does not open a tab', async () => {
    isElectronMock.value = false;
    mount();
    await launch(APP_PLAIN);
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1);
    const calledWith = mockOpenExternalUrl.mock.calls[0]?.[0] as string;
    expect(calledWith).toContain('http://ksp.badousoft.com/');
    expect(calledWith).toContain('Token=token-123');
    // No in-app tab was created.
    expect(ctx.tabs).toHaveLength(0);
  });
});
