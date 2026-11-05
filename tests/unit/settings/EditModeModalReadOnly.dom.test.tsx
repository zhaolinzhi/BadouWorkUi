/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IProvider } from '@/common/config/storage';

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

vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      fetchModelList: { invoke: vi.fn(() => Promise.resolve({ models: [] })) },
    },
  },
}));

vi.mock('@renderer/hooks/agent/useModeModeList', () => ({
  default: () => ({
    data: { models: [] },
    isLoading: false,
    error: null,
    mutate: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('@/renderer/utils/model/modelPlatforms', () => ({
  getProviderLogo: () => null,
}));

vi.mock('@/renderer/components/base/AionModal', () => ({
  default: ({
    header,
    footer,
    children,
    onOk,
    onCancel,
    okText = 'common.save',
    cancelText = 'common.cancel',
  }: {
    header?: { title?: React.ReactNode };
    footer?: React.ReactNode;
    children?: React.ReactNode;
    onOk?: () => void | Promise<void>;
    onCancel?: () => void;
    okText?: string;
    cancelText?: string;
  }) => (
    <div>
      <div data-testid='modal-header'>{header?.title}</div>
      <button data-testid='modal-ok-trigger' onClick={() => void onOk?.()}>
        ok
      </button>
      {children}
      <div data-testid='modal-footer'>
        {footer ?? (
          <>
            <button onClick={onCancel}>{cancelText}</button>
            <button onClick={() => void onOk?.()}>{okText}</button>
          </>
        )}
      </div>
    </div>
  ),
}));

import EditModeModal from '@/renderer/pages/settings/components/EditModeModal';

const provider: IProvider = {
  id: 'newapi-default',
  platform: 'new-api',
  name: '默认',
  base_url: 'https://example.test/v1',
  api_key: 'sk-managed-secret',
  models: ['deepseek-v4-flash'],
  enabled: true,
};

const renderModal = (readOnly: boolean, onChange = vi.fn()) => {
  const close = vi.fn();
  const result = render(
    <EditModeModal
      data={provider}
      readOnly={readOnly}
      onChange={onChange}
      modalProps={{ visible: true }}
      modalCtrl={{ close }}
    />
  );
  return { ...result, onChange, close };
};

describe('EditModeModal — read-only mode', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('hides the API key and base URL and never puts their values in the DOM', () => {
    const { container } = renderModal(true);

    expect(screen.queryByText('settings.apiKey')).toBeNull();
    expect(screen.queryByText('settings.apiEndpoint')).toBeNull();
    expect(screen.queryByText('API 请求地址')).toBeNull();
    expect(container.textContent).not.toContain('sk-managed-secret');
    expect(container.textContent).not.toContain('https://example.test/v1');
  });

  it('shows a read-only marker and a disabled save button', () => {
    renderModal(true);

    expect(screen.getByTestId('modal-header').textContent).toContain('common.readOnly');
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'common.close' })).toBeEnabled();
    // Everything except the credential fields stays normally displayed.
    expect(screen.getByPlaceholderText('settings.modelProvider')).toBeEnabled();
  });

  it('does not emit an update when the save path is triggered', () => {
    const { onChange } = renderModal(true);

    fireEvent.click(screen.getByTestId('modal-ok-trigger'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the credential fields and enabled save path for editable providers', () => {
    renderModal(false);

    expect(screen.getByText('settings.apiKey')).toBeInTheDocument();
    expect(screen.getByText('settings.apiEndpoint')).toBeInTheDocument();
    expect(screen.queryByText('common.readOnly')).toBeNull();
    expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled();
  });
});
