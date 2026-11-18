/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 开发者设置(/settings/developer)的测试。
 *
 * 覆盖三件事:
 *   1. 开发模式下能看到「图标总览」入口,点它跳到 /test/icons —— 这是图标总览页在应用里的正式入口;
 *   2. 打包版(import.meta.env.DEV=false)整块开发者设置都不渲染 —— 正式用户看不到任何开发者入口;
 *   3. 设置导航里的「开发者」分组:开发模式有,打包版没有。
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCdpStatusMock } = vi.hoisted(() => ({
  getCdpStatusMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/renderer/utils/appRestart', () => ({
  notifyManualRestartRequired: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      getCdpStatus: { invoke: getCdpStatusMock },
      isDevToolsOpened: { invoke: vi.fn(() => Promise.resolve(false)) },
      openDevTools: { invoke: vi.fn(() => Promise.resolve(false)) },
      devToolsStateChanged: { on: vi.fn(() => () => {}) },
      updateCdpConfig: { invoke: vi.fn() },
      restart: { invoke: vi.fn() },
    },
    shell: {
      openExternal: { invoke: vi.fn(() => Promise.resolve()) },
    },
  },
}));

// 设置侧栏会拉取扩展 contributed 的 tab —— 一直 pending,避免测试里冒出异步 state 更新。
vi.mock('@/common/adapter/ipcBridge', () => ({
  extensions: {
    getSettingsTabs: { invoke: vi.fn(() => new Promise(() => {})) },
    getExtI18nForLocale: { invoke: vi.fn(() => new Promise(() => {})) },
    stateChanged: { on: vi.fn(() => () => {}) },
  },
}));

import DevSettings from '@renderer/pages/_dev/DeveloperSettings/DevSettings';
import SettingsSider from '@renderer/pages/settings/components/SettingsSider';

const PathProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid='path'>{location.pathname}</div>;
};

const renderDevSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings/developer']}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <DevSettings />
      </SWRConfig>
      <PathProbe />
    </MemoryRouter>
  );

const renderSider = () =>
  render(
    <MemoryRouter initialEntries={['/settings/agent']}>
      <SettingsSider />
    </MemoryRouter>
  );

describe('开发者设置页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCdpStatusMock.mockResolvedValue({
      data: { enabled: false, port: null, startupEnabled: false, configEnabled: false, isDevMode: true },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('开发模式下提供图标总览入口', async () => {
    renderDevSettings();

    expect(await screen.findByText('settings.iconGallery')).toBeInTheDocument();
    expect(await screen.findByText('settings.iconGalleryDesc')).toBeInTheDocument();
    expect(await screen.findByText('settings.openIconGallery')).toBeInTheDocument();
  });

  it('点入口跳到图标总览页', async () => {
    const user = userEvent.setup();
    renderDevSettings();

    await user.click(await screen.findByText('settings.openIconGallery'));

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/test/icons'));
  });

  it('运行期判定为非开发模式时不渲染入口', async () => {
    getCdpStatusMock.mockResolvedValue({
      data: { enabled: false, port: null, startupEnabled: false, configEnabled: false, isDevMode: false },
    });

    renderDevSettings();

    await waitFor(() => expect(getCdpStatusMock).toHaveBeenCalled());
    expect(screen.queryByText('settings.openIconGallery')).toBeNull();
  });

  it('打包版不渲染任何开发者设置', async () => {
    vi.stubEnv('DEV', false);
    renderDevSettings();

    await waitFor(() => expect(getCdpStatusMock).toHaveBeenCalled());
    expect(screen.queryByText('settings.openIconGallery')).toBeNull();
    expect(screen.queryByText('settings.devTools')).toBeNull();
  });
});

describe('设置导航的开发者分组', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('开发模式下显示开发者分组', () => {
    renderSider();

    expect(screen.getByText('settings.groupDeveloper')).toBeInTheDocument();
    expect(screen.getByText('settings.developerSettings')).toBeInTheDocument();
  });

  it('打包版不显示开发者分组', () => {
    vi.stubEnv('DEV', false);
    renderSider();

    expect(screen.queryByText('settings.groupDeveloper')).toBeNull();
    expect(screen.queryByText('settings.developerSettings')).toBeNull();
  });
});
