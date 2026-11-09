/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 知识库首页的回归测试:范围切换、搜索过滤、排序。
 *
 * 页面壳(页头 / 范围切换 / 搜索框 / 工具行)在这里,卡片网格由
 * `KnowledgeBaseGrid` 负责,两边的职责别混。
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

vi.mock('@icon-park/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@icon-park/react')>()),
  MoreOne: () => null,
}));

const { default: KnowledgeBaseHomeTabs } = await import('../KnowledgeBaseHomeTabs');

const personalItems = [
  { id: 'p-1', name: '产品设计资料', isShared: false, documentCount: 4, updatedAt: '2026-10-20' },
  { id: 'p-2', name: '项目交接文档', isShared: false, documentCount: 2, updatedAt: '2026-10-18' },
];

const sharedItems = [{ id: 's-1', name: '团队知识库', isShared: true, documentCount: 6, updatedAt: '2026-10-19' }];

const baseProps = {
  onDelete: vi.fn(),
  onOpenView: vi.fn(),
  onOpenEdit: vi.fn(),
  onCreate: vi.fn(),
  onStartChat: vi.fn(),
};

describe('KnowledgeBaseHomeTabs', () => {
  it('渲染页头、范围切换与新建按钮', () => {
    render(<KnowledgeBaseHomeTabs personalItems={personalItems} sharedItems={sharedItems} {...baseProps} />);

    expect(screen.getByText('知识库')).toBeTruthy();
    expect(screen.getByTestId('kb-tab-personal')).toBeTruthy();
    expect(screen.getByTestId('kb-tab-shared')).toBeTruthy();
    expect(screen.getByTestId('btn-create-knowledge-base')).toBeTruthy();
  });

  it('点击「新建知识库」调用 onCreate', () => {
    const onCreate = vi.fn();
    render(
      <KnowledgeBaseHomeTabs
        personalItems={personalItems}
        sharedItems={sharedItems}
        {...baseProps}
        onCreate={onCreate}
      />
    );

    fireEvent.click(screen.getByTestId('btn-create-knowledge-base'));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('统计行给出知识库数量与文档数', () => {
    render(<KnowledgeBaseHomeTabs personalItems={personalItems} sharedItems={sharedItems} {...baseProps} />);

    expect(screen.getByText('全部知识库')).toBeTruthy();
    expect(screen.getByText('2 个知识库 · 6 份文档')).toBeTruthy();
  });

  it('搜索框按名称过滤卡片', () => {
    render(<KnowledgeBaseHomeTabs personalItems={personalItems} sharedItems={sharedItems} {...baseProps} />);

    const input = screen.getByTestId('kb-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '交接' } });

    expect(screen.getByTestId('kb-card-p-2')).toBeTruthy();
    expect(screen.queryByTestId('kb-card-p-1')).toBeNull();
  });

  it('搜索无结果时给出「暂无搜索结果」的空态', () => {
    render(<KnowledgeBaseHomeTabs personalItems={personalItems} sharedItems={sharedItems} {...baseProps} />);

    const input = screen.getByTestId('kb-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '不存在的知识库' } });

    expect(screen.getByTestId('empty-state-title').textContent).toBe('暂无搜索结果');
  });

  it('切到共享知识库后展示共享库卡片,并清空搜索词', () => {
    render(<KnowledgeBaseHomeTabs personalItems={personalItems} sharedItems={sharedItems} {...baseProps} />);

    const input = screen.getByTestId('kb-search') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '交接' } });
    fireEvent.click(screen.getByTestId('kb-tab-shared'));

    expect(screen.getByTestId('kb-card-s-1')).toBeTruthy();
    expect(screen.queryByTestId('kb-card-p-2')).toBeNull();
    const sharedInput = screen.getByTestId('kb-search') as HTMLInputElement;
    expect(sharedInput.value).toBe('');
  });

  it('列表为空时不渲染搜索框与工具行', () => {
    render(<KnowledgeBaseHomeTabs personalItems={[]} sharedItems={[]} {...baseProps} />);

    expect(screen.queryByTestId('kb-search')).toBeNull();
    expect(screen.queryByText('全部知识库')).toBeNull();
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });
});
