/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记编辑器(Vditor)的图片上传回归测试。
 *
 * 踩过的坑:微应用拿到的 `baseApi` 在 Electron 下曾经是相对路径 `/api`,
 * Vditor 的 XHR 就把 `POST /api/fs/upload` 打到了 renderer 自己的源
 * (dev 下是 Vite dev server → 404),粘贴的图永远传不上去。
 * 修法在 shell 侧(`MicroAppHost` 给绝对地址),这里锁住「上传地址必须
 * 由 ctx.baseApi 拼出来」,以及成功后图片确实被插进编辑器。
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

/** Vditor 的 upload 配置 —— 只列本组用例关心的字段。 */
type VditorUploadOptions = {
  url: string;
  fieldName: string;
  headers: Record<string, string>;
  success: (editorElement: HTMLElement, responseText: string) => Promise<void>;
  error: (responseText: string) => void;
};

type CapturedOptions = { upload: VditorUploadOptions };

const { captured, tipShow, tipHide, insertValue } = vi.hoisted(() => ({
  captured: [] as CapturedOptions[],
  tipShow: vi.fn(),
  tipHide: vi.fn(),
  insertValue: vi.fn(),
}));

vi.mock('vditor', () => {
  class VditorMock {
    options: CapturedOptions;
    vditor = { tip: { show: tipShow, hide: tipHide }, upload: {} as Record<string, unknown> };
    insertValue = insertValue;
    setTheme = vi.fn();
    getValue = () => '';
    setValue = vi.fn();
    constructor(_id: string, options: CapturedOptions) {
      this.options = options;
      captured.push(options);
    }
    destroy() {
      /* noop */
    }
  }
  return { default: VditorMock };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

import VditorEditor from '../VditorEditor';
import { AppContext } from '../../AppContext';
import type { MicroAppProps } from '@renderer/micro-app/types';

const BASE_API = 'http://127.0.0.1:50548/api';

const context = {
  token: 'test-token',
  userInfo: { id: 'u1', username: 'dev', permissions: [], tenantId: '' },
  systemCode: 'aionui',
  baseApi: BASE_API,
  shellVersion: '0.0.0',
  theme: 'light',
  locale: 'zh-CN',
  isMobile: false,
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
} as unknown as MicroAppProps;

const renderEditor = () =>
  render(
    <AppContext.Provider value={context}>
      <VditorEditor value='' onChange={() => {}} theme='light' />
    </AppContext.Provider>
  );

describe('VditorEditor 图片上传', () => {
  beforeEach(() => {
    captured.length = 0;
    vi.clearAllMocks();
  });

  it('上传地址由 ctx.baseApi 拼出来(必须是能打到后端的地址)', async () => {
    renderEditor();
    await waitFor(() => expect(captured.length).toBe(1));

    const upload = captured[0].upload;
    expect(upload.url).toBe(`${BASE_API}/fs/upload`);
    expect(upload.fieldName).toBe('file');
    expect(upload.headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  it('上传成功后拉 base64 并把图片插进编辑器,顺手收起上传提示', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ success: true, data: 'data:image/png;base64,AAA' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    renderEditor();
    await waitFor(() => expect(captured.length).toBe(1));

    const upload = captured[0].upload;
    await upload.success(document.createElement('div'), JSON.stringify({ success: true, data: '/tmp/a.png' }));

    // 先取 base64,再插图
    expect(fetchMock).toHaveBeenCalledWith(`${BASE_API}/fs/image-base64`, expect.objectContaining({ method: 'POST' }));
    expect(insertValue).toHaveBeenCalledWith('![a.png](data:image/png;base64,AAA)');
    // 「上传中...」的提示由 Vditor 自己弹,自定义 success 回调要负责收起
    expect(tipHide).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('上传失败时收起提示并把后端返回的状态片段透出来', () => {
    renderEditor();
    const upload = captured[0].upload;
    upload.error('404 Not Found');

    expect(tipHide).toHaveBeenCalled();
    expect(tipShow).toHaveBeenCalledWith('404 Not Found');
  });
});
