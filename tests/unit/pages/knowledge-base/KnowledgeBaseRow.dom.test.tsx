/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
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
    t: (key: string, options?: { defaultValue?: string }) => {
      const map: Record<string, string> = {
        'settings.knowledgeBaseGoChat': '对话',
        'common.edit': '编辑',
        'common.delete': '删除',
        'common.more': '更多',
        'settings.knowledgeBaseDocumentCount': `${options?.count ?? 0} docs`,
      };
      return map[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

vi.mock('@icon-park/react', () => ({
  MoreOne: () => null,
}));

vi.mock('@/renderer/pages/knowledge-base/KnowledgeBaseAvatar', () => ({
  default: () => null,
}));

const { default: KnowledgeBaseRow } = await import('@/renderer/pages/knowledge-base/KnowledgeBaseRow');

const baseItem = {
  id: 'kb-1',
  name: 'My KB',
  description: 'desc',
  isShared: false,
  documentCount: 3,
  updatedAt: '2026-08-25',
};

describe('KnowledgeBaseRow — chat button default visibility', () => {
  it('renders the chat button without hidden / opacity-0 classes by default', () => {
    render(
      <KnowledgeBaseRow item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onOpen={vi.fn()} onStartChat={vi.fn()} />
    );
    const chatBtn = screen.getByTestId('btn-kb-chat-kb-1');
    expect(chatBtn.className).not.toMatch(/!hidden/);
    expect(chatBtn.className).not.toMatch(/!opacity-0/);
    expect(chatBtn.className).not.toMatch(/group-hover:!opacity-100/);
    expect(chatBtn.className).toMatch(/!inline-flex/);
    expect(chatBtn.className).toMatch(/!opacity-100/);
    expect(chatBtn.textContent).toBe('对话');
  });

  it('calls onStartChat (and not onOpen) when the chat button is clicked', () => {
    const onStartChat = vi.fn();
    const onOpen = vi.fn();
    render(
      <KnowledgeBaseRow item={baseItem} onEdit={vi.fn()} onDelete={vi.fn()} onOpen={onOpen} onStartChat={onStartChat} />
    );
    fireEvent.click(screen.getByTestId('btn-kb-chat-kb-1'));
    expect(onStartChat).toHaveBeenCalledWith(baseItem);
    expect(onStartChat).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('hides the delete menu item when hideDelete is true', () => {
    render(
      <KnowledgeBaseRow
        item={{ ...baseItem, source: 'user' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onStartChat={vi.fn()}
        hideDelete
      />
    );
    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));
    expect(screen.queryByTestId('kb-menu-delete-kb-1')).toBeNull();
    expect(screen.getByTestId('kb-menu-edit-kb-1')).toBeTruthy();
  });

  it('shows the delete menu item by default when source is user and not readonly', () => {
    render(
      <KnowledgeBaseRow
        item={{ ...baseItem, source: 'user' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onStartChat={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));
    expect(screen.getByTestId('kb-menu-delete-kb-1')).toBeTruthy();
    expect(screen.getByTestId('kb-menu-edit-kb-1')).toBeTruthy();
  });

  it('edit menu item calls onOpen (matching the row click behavior) and not onEdit', () => {
    const onEdit = vi.fn();
    const onOpen = vi.fn();
    render(
      <KnowledgeBaseRow
        item={{ ...baseItem, source: 'user' }}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onOpen={onOpen}
        onStartChat={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('btn-kb-more-kb-1'));
    fireEvent.click(screen.getByTestId('kb-menu-edit-kb-1'));
    expect(onOpen).toHaveBeenCalledWith({ ...baseItem, source: 'user' });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('does not render the more menu button when noMenu is true', () => {
    render(
      <KnowledgeBaseRow
        item={{ ...baseItem, source: 'user' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onStartChat={vi.fn()}
        noMenu
      />
    );
    expect(screen.queryByTestId('btn-kb-more-kb-1')).toBeNull();
  });

  it('row click still calls onOpen when noMenu is true', () => {
    const onOpen = vi.fn();
    render(
      <KnowledgeBaseRow
        item={{ ...baseItem, source: 'user' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={onOpen}
        onStartChat={vi.fn()}
        noMenu
      />
    );
    fireEvent.click(screen.getByTestId('kb-card-kb-1'));
    expect(onOpen).toHaveBeenCalledWith({ ...baseItem, source: 'user' });
  });
});
