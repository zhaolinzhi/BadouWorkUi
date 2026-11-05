/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 侧栏宽度过渡期间,内容区必须保持一个**稳定宽度**。
 *
 * 背景
 * ====
 * Arco 的 `.arco-layout-sider` 过渡的是 `width`。只要内容区跟着这个宽度
 * 逐帧变化,聊天区(消息、markdown、预览)就会被逐帧重新排版 —— 一次收
 * 要付 12 次全页 reflow,肉眼看到的就是「十分卡顿」。
 *
 * 现在的做法:侧栏浮在内容区之上,内容区用 `padding-left` 让出侧栏的位置。
 * 过渡开始时内容区**立刻**采用目标几何(展开=248px / 收缩=72px),之后
 * 全程不变:
 *  - 展开:内容区一次性让位,侧栏在空白背景上长大,不遮挡任何文字;
 *  - 收缩:内容区一次性左移,侧栏从内容区上方收走。
 *
 * 两种方向都只付一次 reflow,过渡期间零布局工作。此前把 inset 钉在收缩
 * 宽度上的做法在展开方向上更省,但过渡结束时整列会跳一下 —— 那一跳
 * 反而比 reflow 更刺眼。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/guid', search: '', hash: '' }),
  useNavigationType: () => 'POP',
  Outlet: () => null,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      openDevTools: { invoke: () => Promise.resolve() },
      logStream: { on: () => () => {} },
    },
    task: { stopAll: { invoke: () => Promise.resolve({ success: false }) } },
  },
}));

vi.mock('@/common/config/constants', () => ({
  get TEAM_MODE_ENABLED() {
    return false;
  },
}));

vi.mock('@renderer/components/layout/PwaPullToRefresh', () => ({ default: () => null }));
vi.mock('@renderer/components/layout/Titlebar', () => ({ default: () => null }));
vi.mock('@renderer/components/settings/UpdateModal', () => ({ default: () => null }));
vi.mock('@renderer/hooks/system/useDeepLink', () => ({ useDeepLink: () => {} }));
vi.mock('@renderer/hooks/system/notification/useNotificationClick', () => ({ useNotificationClick: () => {} }));
vi.mock('@renderer/hooks/system/notification/useBrowserNotification', () => ({ useBrowserNotification: () => {} }));
vi.mock('@renderer/utils/ui/siderTooltip', () => ({ cleanupSiderTooltips: () => {} }));
vi.mock('@renderer/utils/platform', () => ({ isElectronDesktop: () => false }));
vi.mock('@renderer/pages/conversation/Preview', () => ({
  PreviewPanel: () => null,
  usePreviewContext: () => ({ closePreview: () => {}, isOpen: false }),
}));
vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({ closePreview: () => {}, isOpen: false }),
}));

const shortcutMocks = vi.hoisted(() => ({
  params: undefined as undefined | { toggleSider: () => void },
}));
vi.mock('@renderer/hooks/ui/useConversationShortcuts', () => ({
  useConversationShortcuts: (params: { toggleSider: () => void }) => {
    shortcutMocks.params = params;
  },
}));

import Layout from '@renderer/components/layout/Layout';
import { SIDER_ANIMATION_WINDOW_MS } from '@renderer/utils/ui/siderAnimation';

const COLLAPSED_INSET = '72px';
const EXPANDED_INSET = '248px';

const renderLayout = () => render(<Layout sider={<div>sider</div>} />);

const getInset = (container: HTMLElement): string => {
  const row = container.querySelector('.layout-main-row') as HTMLElement | null;
  if (!row) throw new Error('content row not found');
  return row.style.paddingLeft;
};

describe('Layout sider width transition', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    localStorage.clear();
    shortcutMocks.params = undefined;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('takes the expanded width immediately when the sider expands and keeps it stable', () => {
    const { container } = renderLayout();

    // 桌面端默认收缩。
    expect(getInset(container)).toBe(COLLAPSED_INSET);

    act(() => shortcutMocks.params?.toggleSider());

    // 过渡一开始内容区就采用最终宽度,过渡期间不再变化。
    expect(getInset(container)).toBe(EXPANDED_INSET);

    act(() => {
      vi.advanceTimersByTime(SIDER_ANIMATION_WINDOW_MS);
    });

    expect(getInset(container)).toBe(EXPANDED_INSET);
  });

  it('takes the collapsed width immediately when the sider collapses and keeps it stable', () => {
    const { container } = renderLayout();

    act(() => shortcutMocks.params?.toggleSider());
    act(() => {
      vi.advanceTimersByTime(SIDER_ANIMATION_WINDOW_MS);
    });
    expect(getInset(container)).toBe(EXPANDED_INSET);

    act(() => shortcutMocks.params?.toggleSider());

    // 收缩时内容区立刻让出空间(否则侧栏收窄后会露出一条空隙),
    // 过渡期间宽度保持稳定。
    expect(getInset(container)).toBe(COLLAPSED_INSET);

    act(() => {
      vi.advanceTimersByTime(SIDER_ANIMATION_WINDOW_MS);
    });

    expect(getInset(container)).toBe(COLLAPSED_INSET);
  });
});
