/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 图标总览页(`/test/icons`)的测试。
 *
 * 覆盖三件开发者真正依赖的行为:
 *   1. 页面列的是**全部**已登记图标 —— 数据源是共享层的 ICON_MAP,不是页面自己维护的清单;
 *   2. 点图标复制的是**语义名**(写进 `<AppIcon name='...' />` 的那个名字);
 *   3. 搜索能按名字过滤,搜不到时有明确提示而不是空白页。
 */

import { Message } from '@arco-design/web-react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@renderer/utils/ui/clipboard', () => ({
  copyText: vi.fn().mockResolvedValue(undefined),
}));

import { ICON_MAP } from '@aionui/ui';
import { copyText } from '@renderer/utils/ui/clipboard';
import IconGalleryPage from '@renderer/pages/_dev/IconGalleryPage';

const copyTextMock = vi.mocked(copyText);

describe('IconGalleryPage', () => {
  beforeEach(() => {
    copyTextMock.mockReset();
    copyTextMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Arco 的 Message 挂在 body 上,不受 testing-library 的 cleanup 管辖。
    Message.clear();
  });

  it('列出全部已登记的图标,一个都不少', () => {
    render(<IconGalleryPage />);

    const names = Object.keys(ICON_MAP);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('点击图标复制它的语义名', async () => {
    render(<IconGalleryPage />);

    const tile = screen.getByText('plus').closest('button');
    expect(tile).toBeTruthy();
    fireEvent.click(tile as HTMLButtonElement);

    await waitFor(() => expect(copyTextMock).toHaveBeenCalledWith('plus'));
    expect(copyTextMock).toHaveBeenCalledTimes(1);
    // 提示条是异步挂到 body 上的,得等它出现 —— 直接断言会偶发失败。
    await waitFor(() => expect(screen.getByText('已复制 plus')).toBeTruthy());
  });

  it('复制失败时给出失败提示,而不是静默无反应', async () => {
    copyTextMock.mockRejectedValue(new Error('clipboard unavailable'));
    render(<IconGalleryPage />);

    const tile = screen.getByText('book').closest('button');
    fireEvent.click(tile as HTMLButtonElement);

    await waitFor(() => expect(screen.getByText('复制 book 失败')).toBeTruthy());
    expect(screen.queryByText('已复制 book')).toBeNull();
  });

  it('搜索按名字过滤,只留下匹配项', () => {
    render(<IconGalleryPage />);

    fireEvent.change(screen.getByPlaceholderText('搜索图标名'), { target: { value: 'book' } });

    expect(screen.getByText('book')).toBeTruthy();
    expect(screen.getByText('book-one')).toBeTruthy();
    expect(screen.queryByText('plus')).toBeNull();
  });

  it('搜不到时给出提示,而不是空白页', () => {
    render(<IconGalleryPage />);

    fireEvent.change(screen.getByPlaceholderText('搜索图标名'), { target: { value: 'no-such-icon' } });

    expect(screen.getByText('没有匹配「no-such-icon」的图标')).toBeTruthy();
    expect(screen.queryByText('plus')).toBeNull();
  });
});
