/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IProvider } from '@/common/config/storage';

const providerState = vi.hoisted(() => ({
  data: [] as IProvider[],
  mutate: vi.fn(),
}));

const ipcBridgeMock = vi.hoisted(() => ({
  listProviders: vi.fn(() => Promise.resolve([])),
  updateProvider: vi.fn(() => Promise.resolve()),
  createProvider: vi.fn(() => Promise.resolve()),
  deleteProvider: vi.fn(() => Promise.resolve()),
  checkProviderHealth: vi.fn(() => Promise.resolve({ status: 'healthy', elapsed_ms: 1 })),
}));

const modalControl = vi.hoisted(() => ({
  openEdit: vi.fn(),
  closeEdit: vi.fn(),
  openAddModel: vi.fn(),
  openAddPlatform: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));

vi.mock('@arco-design/web-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arco-design/web-react')>();
  const messageApi = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  return {
    ...actual,
    Message: Object.assign(vi.fn(), { ...messageApi, useMessage: () => [messageApi, null] }),
  };
});

vi.mock('@/renderer/hooks/agent/useModelProviderList', () => ({
  useProvidersQuery: () => ({ data: providerState.data, mutate: providerState.mutate }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      listProviders: { invoke: ipcBridgeMock.listProviders },
      updateProvider: { invoke: ipcBridgeMock.updateProvider },
      createProvider: { invoke: ipcBridgeMock.createProvider },
      deleteProvider: { invoke: ipcBridgeMock.deleteProvider },
    },
    acpConversation: {
      checkProviderHealth: { invoke: ipcBridgeMock.checkProviderHealth },
    },
  },
}));

vi.mock('@/renderer/components/base/AionScrollArea', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/base/TalkToButlerButton', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/settings/components/AddPlatformModal', () => {
  const Modal = () => null;
  return {
    default: Object.assign(Modal, {
      useModal: () => [{ open: modalControl.openAddPlatform, close: vi.fn() }, null],
    }),
  };
});

vi.mock('@/renderer/pages/settings/components/AddModelModal', () => {
  const Modal = () => null;
  return {
    default: Object.assign(Modal, {
      useModal: () => [{ open: modalControl.openAddModel, close: vi.fn() }, null],
    }),
  };
});

vi.mock('@/renderer/pages/settings/components/EditModeModal', () => {
  const Modal = () => null;
  return {
    default: Object.assign(Modal, {
      useModal: () => [{ open: modalControl.openEdit, close: modalControl.closeEdit }, null],
    }),
  };
});

vi.mock('@/renderer/hooks/system/useDeepLink', () => ({
  consumePendingDeepLink: () => null,
}));

import ModelModalContent from '@/renderer/components/settings/SettingsModal/contents/ModelModalContent';

const managedProvider: IProvider = {
  id: 'newapi-default',
  platform: 'new-api',
  name: '默认',
  base_url: 'https://example.test/v1',
  api_key: 'sk-managed-secret',
  models: ['deepseek-v4-flash'],
  model_protocols: { 'deepseek-v4-flash': 'openai' },
  enabled: true,
};

const normalProvider: IProvider = {
  id: 'custom-1',
  platform: 'custom',
  name: '自定义',
  base_url: 'https://custom.test/v1',
  api_key: 'sk-normal-key',
  models: ['gpt-4o'],
  enabled: true,
};

describe('ModelModalContent — system-managed provider', () => {
  beforeEach(() => {
    providerState.data = [];
    providerState.mutate.mockReset();
    Object.values(ipcBridgeMock).forEach((mock) => mock.mockClear());
    Object.values(modalControl).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the managed provider without rendering its API key', async () => {
    providerState.data = [managedProvider];
    const { container } = render(<ModelModalContent />);

    expect(await screen.findByText('默认')).toBeInTheDocument();
    expect(screen.getByText('common.readOnly')).toBeInTheDocument();
    expect(container.textContent).not.toContain('sk-managed-secret');
  });

  it('keeps only the read-only view button for the managed provider', async () => {
    providerState.data = [managedProvider];
    render(<ModelModalContent />);

    await screen.findByText('默认');
    expect(screen.getByTestId('provider-edit-newapi-default')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-add-model-newapi-default')).toBeNull();
    expect(screen.queryByTestId('provider-delete-newapi-default')).toBeNull();
    expect(screen.getByTestId('provider-toggle-newapi-default')).toBeDisabled();
  });

  it('opens the provider config in read-only mode', async () => {
    providerState.data = [managedProvider];
    render(<ModelModalContent />);

    fireEvent.click(await screen.findByTestId('provider-edit-newapi-default'));

    expect(modalControl.openEdit).toHaveBeenCalledWith({ data: managedProvider, readOnly: true });
  });

  it('hides model-level mutation controls for the managed provider', async () => {
    providerState.data = [managedProvider];
    render(<ModelModalContent />);

    fireEvent.click(await screen.findByText('默认'));

    expect(await screen.findByTestId('model-toggle-newapi-default-deepseek-v4-flash')).toBeDisabled();
    expect(screen.queryByTestId('model-configure-newapi-default-deepseek-v4-flash')).toBeNull();
    expect(screen.queryByTestId('model-health-newapi-default-deepseek-v4-flash')).toBeNull();
    expect(screen.queryByTestId('model-delete-newapi-default-deepseek-v4-flash')).toBeNull();
    expect(screen.queryByText('sk-managed-secret')).toBeNull();
  });

  it('does not rotate the protocol when the read-only protocol tag is clicked', async () => {
    providerState.data = [managedProvider];
    render(<ModelModalContent />);

    fireEvent.click(await screen.findByText('默认'));
    fireEvent.click(await screen.findByTestId('model-protocol-newapi-default-deepseek-v4-flash'));

    expect(ipcBridgeMock.updateProvider).not.toHaveBeenCalled();
  });

  it('keeps all mutation controls for user-created providers', async () => {
    providerState.data = [normalProvider];
    render(<ModelModalContent />);

    expect(await screen.findByText('自定义')).toBeInTheDocument();
    expect(screen.getByTestId('provider-edit-custom-1')).toBeInTheDocument();
    expect(screen.getByTestId('provider-add-model-custom-1')).toBeInTheDocument();
    expect(screen.getByTestId('provider-delete-custom-1')).toBeInTheDocument();
    expect(screen.getByTestId('provider-toggle-custom-1')).toBeEnabled();

    fireEvent.click(screen.getByTestId('provider-edit-custom-1'));
    expect(modalControl.openEdit).toHaveBeenCalledWith({ data: normalProvider, readOnly: false });

    fireEvent.click(screen.getByText('自定义'));
    expect(await screen.findByTestId('model-configure-custom-1-gpt-4o')).toBeInTheDocument();
    expect(screen.getByTestId('model-health-custom-1-gpt-4o')).toBeInTheDocument();
    expect(screen.getByTestId('model-delete-custom-1-gpt-4o')).toBeInTheDocument();
    expect(screen.getByTestId('model-toggle-custom-1-gpt-4o')).toBeEnabled();
  });

  it('skips the managed provider when clearing health status for all providers', async () => {
    providerState.data = [managedProvider, normalProvider];
    render(<ModelModalContent />);

    fireEvent.click(await screen.findByText('settings.clearStatus'));

    await waitFor(() => expect(ipcBridgeMock.updateProvider).toHaveBeenCalled());
    const updatedIds = ipcBridgeMock.updateProvider.mock.calls.map(([payload]) => payload.id);
    expect(updatedIds).toContain('custom-1');
    expect(updatedIds).not.toContain('newapi-default');
  });
});
