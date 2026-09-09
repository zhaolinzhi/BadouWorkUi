/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import FilePreview from '@/renderer/components/media/FilePreview';

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      getFileMetadata: { invoke: vi.fn().mockResolvedValue({ size: 100 }) },
      getImageBase64: { invoke: vi.fn().mockResolvedValue('') },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('FilePreview inlineAction', () => {
  it('renders inlineAction when provided', () => {
    render(
      <FilePreview
        path='/tmp/test.txt'
        onRemove={() => {}}
        inlineAction={<button data-testid='paste-original'>粘贴原文至输入框</button>}
      />
    );
    expect(screen.getByTestId('paste-original')).toBeTruthy();
  });

  it('does not render inline action container when inlineAction is omitted', () => {
    const { container } = render(<FilePreview path='/tmp/test.txt' onRemove={() => {}} />);
    expect(container.querySelector('[data-testid="file-preview-inline-action"]')).toBeNull();
  });
});