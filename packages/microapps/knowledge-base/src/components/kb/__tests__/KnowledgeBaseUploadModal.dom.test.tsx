/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 上传文件弹窗：拖拽区、待上传清单、移除、提交、错误展示。
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  // Arco 组件挂载时会读 window.matchMedia，jsdom 没有。
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const { default: KnowledgeBaseUploadModal } = await import('../KnowledgeBaseUploadModal');

const makeFile = (name: string) => new File(['x'], name, { type: 'text/plain' });

const uploadFile = (name: string) => ({
  uid: `uid-${name}`,
  name,
  file: makeFile(name),
});

/** 模拟用户在 Arco 的隐藏 file input 里选了文件。 */
const selectFiles = (names: string[]) => {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('no file input rendered');
  const files = names.map((name) => makeFile(name));
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
};

describe('KnowledgeBaseUploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染拖拽区、标题与底部按钮', () => {
    render(<KnowledgeBaseUploadModal visible onCancel={vi.fn()} onSubmit={vi.fn()} knowledgeBaseName='产品设计资料' />);

    expect(screen.getByTestId('kb-upload-dropzone')).toBeTruthy();
    expect(screen.getByTestId('kb-upload-submit')).toBeTruthy();
    expect(screen.getByTestId('kb-upload-cancel')).toBeTruthy();
    // 副标题里带上知识库名
    expect(screen.getByText(/产品设计资料/)).toBeTruthy();
  });

  it('没有文件时提交按钮禁用', () => {
    render(<KnowledgeBaseUploadModal visible onCancel={vi.fn()} onSubmit={vi.fn()} files={[]} />);

    expect((screen.getByTestId('kb-upload-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('选择文件后回调 onAddFiles', async () => {
    const onAddFiles = vi.fn();
    render(
      <KnowledgeBaseUploadModal visible onCancel={vi.fn()} onSubmit={vi.fn()} onAddFiles={onAddFiles} files={[]} />
    );

    selectFiles(['a.md']);

    // Arco 的 beforeUpload 是异步的 —— 等一个 tick。
    await waitFor(() => expect(onAddFiles).toHaveBeenCalledTimes(1));
    expect(onAddFiles.mock.calls[0][0][0].name).toBe('a.md');
  });

  it('待上传清单展示文件名与格式', () => {
    render(
      <KnowledgeBaseUploadModal
        visible
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        files={[uploadFile('a.md'), uploadFile('b.pdf')]}
      />
    );

    expect(screen.getByTestId('kb-upload-pending')).toBeTruthy();
    expect(screen.getByTestId('kb-upload-file-0').textContent).toContain('a.md');
    expect(screen.getByTestId('kb-upload-file-0').textContent).toContain('MD');
    expect(screen.getByTestId('kb-upload-file-1').textContent).toContain('b.pdf');
    expect(screen.getByTestId('kb-upload-file-1').textContent).toContain('PDF');
  });

  it('点移除按钮回调 onRemoveFile', () => {
    const onRemoveFile = vi.fn();
    render(
      <KnowledgeBaseUploadModal
        visible
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        onRemoveFile={onRemoveFile}
        files={[uploadFile('a.md')]}
      />
    );

    fireEvent.click(screen.getByTestId('kb-upload-remove-0'));

    expect(onRemoveFile).toHaveBeenCalledWith('uid-a.md');
  });

  it('点提交回调 onSubmit', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<KnowledgeBaseUploadModal visible onCancel={vi.fn()} onSubmit={onSubmit} files={[uploadFile('a.md')]} />);

    fireEvent.click(screen.getByTestId('kb-upload-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('展示上传失败的错误', () => {
    render(
      <KnowledgeBaseUploadModal visible onCancel={vi.fn()} onSubmit={vi.fn()} files={[]} error='上传失败，请稍后重试' />
    );

    expect(screen.getByTestId('kb-upload-error').textContent).toBe('上传失败，请稍后重试');
  });
});
