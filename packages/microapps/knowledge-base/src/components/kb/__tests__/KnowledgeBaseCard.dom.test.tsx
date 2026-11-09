/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 知识库卡片(设计稿的 `.kb-card`)的回归测试。
 *
 * 卡片承载三件事:打开知识库、发起问答、以及个人库里的编辑/删除入口。
 * 这里锁住它们各自触发哪个回调 —— 卡片是整块可点的,最容易把「点卡片」和
 * 「点菜单项」串起来。
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

// 只把 MoreOne 换成空组件(断言不关心图标本身)。
// 不能整包 mock —— `@aionui/ui` 的图标映射表也 import 了这个包,
// 缺哪个导出 Vitest 会直接抛错。
vi.mock('@icon-park/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@icon-park/react')>()),
  MoreOne: () => null,
}));

vi.mock('../../KnowledgeBaseAvatar', () => ({
  default: () => null,
}));

const { default: KnowledgeBaseCard } = await import('../KnowledgeBaseCard');

const baseItem = {
  id: 'kb-1',
  name: '产品设计资料',
  description: '设计规范、组件说明与产品需求。',
  isShared: false,
  documentCount: 3,
  updatedAt: '2026-10-20',
};

describe('KnowledgeBaseCard', () => {
  it('渲染名称、描述、文档数与更新时间', () => {
    render(<KnowledgeBaseCard item={baseItem} onOpen={vi.fn()} onStartChat={vi.fn()} />);

    expect(screen.getByTestId('kb-card-kb-1').textContent).toContain('产品设计资料');
    expect(screen.getByTestId('kb-card-kb-1').textContent).toContain('设计规范、组件说明与产品需求。');
    expect(screen.getByTestId('kb-card-kb-1').textContent).toContain('3 份文档');
    expect(screen.getByTestId('kb-card-kb-1').textContent).toContain('更新于 2026-10-20');
  });

  it('点击卡片调用 onOpen', () => {
    const onOpen = vi.fn();
    render(<KnowledgeBaseCard item={baseItem} onOpen={onOpen} onStartChat={vi.fn()} />);

    fireEvent.click(screen.getByTestId('kb-card-kb-1'));

    expect(onOpen).toHaveBeenCalledWith(baseItem);
  });

  it('菜单里的「对话」调用 onStartChat,不会触发 onOpen', () => {
    const onStartChat = vi.fn();
    const onOpen = vi.fn();
    render(<KnowledgeBaseCard item={baseItem} onOpen={onOpen} onStartChat={onStartChat} />);

    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));
    fireEvent.click(screen.getByTestId('kb-menu-chat-kb-1'));

    expect(onStartChat).toHaveBeenCalledWith(baseItem);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('个人库的菜单里有「编辑」,点击走 onOpenEdit', () => {
    const onOpen = vi.fn();
    const onOpenEdit = vi.fn();
    render(
      <KnowledgeBaseCard
        item={{ ...baseItem, source: 'user' }}
        onOpen={onOpen}
        onOpenEdit={onOpenEdit}
        onStartChat={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));
    expect(screen.getByTestId('kb-menu-edit-kb-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('kb-menu-edit-kb-1'));
    expect(onOpenEdit).toHaveBeenCalledWith({ ...baseItem, source: 'user' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('个人库不暴露删除项', () => {
    render(
      <KnowledgeBaseCard item={{ ...baseItem, source: 'user' }} onOpen={vi.fn()} onStartChat={vi.fn()} hideDelete />
    );

    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));

    expect(screen.queryByTestId('kb-menu-delete-kb-1')).toBeNull();
    expect(screen.getByTestId('kb-menu-edit-kb-1')).toBeTruthy();
  });

  it('共享库是只读的:菜单里没有编辑与删除', () => {
    render(
      <KnowledgeBaseCard
        item={{ ...baseItem, isShared: true, source: 'user' }}
        onOpen={vi.fn()}
        onStartChat={vi.fn()}
        readOnly
      />
    );

    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));

    expect(screen.getByTestId('kb-menu-chat-kb-1')).toBeTruthy();
    expect(screen.queryByTestId('kb-menu-edit-kb-1')).toBeNull();
    expect(screen.queryByTestId('kb-menu-delete-kb-1')).toBeNull();
  });
});
