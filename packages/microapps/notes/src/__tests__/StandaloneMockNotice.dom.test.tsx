/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「演示数据」提示条的行为测试。
 *
 * 这条横幅解决的是"独立运行看到 Inbox / Work,嵌到主应用却是空的,像是数据丢了"
 * 这个误解 —— 独立运行时页面上的笔记本全是 `__qiankun__/standaloneMock.ts` 里
 * 的内存种子数据。
 *
 * 关键约束:提示条**只在独立运行(dev + 无宿主)**下出现。被 shell 托管时它必须
 * 一个像素都不占,否则主应用里的笔记页顶部会多出一条谁也看不懂的横幅。
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// jest-dom 的 matcher 类型增强。运行时由 `tests/vitest.dom.setup.ts` 引入,
// 这里再引一次是为了让 `tsc` 在本包内也能认到 `toBeInTheDocument`。
import '@testing-library/jest-dom/vitest';

const mockState = vi.hoisted(() => ({ active: false }));

const tCalls = vi.hoisted(() => [] as string[]);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // 与 react-i18next 未初始化时的行为一致:有 defaultValue 就用它,没有就返回 key。
    // standalone(dev 直开子应用)下没有 shell 的 i18n 实例,走的正是这条分支。
    t: (k: string, opts?: Record<string, unknown>) => {
      tCalls.push(k);
      return typeof opts?.defaultValue === 'string' ? opts.defaultValue : k;
    },
  }),
}));

vi.mock('../__qiankun__/standaloneMock', () => ({
  isStandaloneMockActive: () => mockState.active,
}));

import StandaloneMockNotice from '../components/StandaloneMockNotice';

describe('StandaloneMockNotice', () => {
  beforeEach(() => {
    mockState.active = false;
    tCalls.length = 0;
  });

  it('renders nothing when the standalone mock bridge is not installed', () => {
    const { container } = render(<StandaloneMockNotice />);
    // 被 shell 托管时既不渲染横幅、也不调 t() —— 主应用布局完全不受影响。
    expect(container.firstChild).toBeNull();
    expect(tCalls).toEqual([]);
  });

  it('renders the demo-data notice when the standalone mock bridge is installed', () => {
    mockState.active = true;
    render(<StandaloneMockNotice />);

    const notice = screen.getByRole('status');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain('built-in demo data');
  });

  it('uses an i18n key instead of a hardcoded string', () => {
    mockState.active = true;
    render(<StandaloneMockNotice />);

    expect(tCalls).toContain('settings.notesStandaloneMockNotice');
  });
});
