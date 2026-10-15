/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verifies that the GuidInputCard highlight overlay renders the
 * renderer-visible @kb:<name> token as a single blue badge whose text
 * contains the KB name (not the kbId).
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stubs for the heavy hooks in the component tree so we don't have to wire
// AuthProvider/LayoutContext/SWR for what is essentially a render-text test.
vi.mock('@/common', () => ({
  ipcBridge: {},
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k),
  }),
}));
vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));
vi.mock('@/renderer/hooks/chat/useCompositionInput', () => ({
  useCompositionInput: () => ({
    compositionHandlers: {},
    isComposing: { current: false },
  }),
}));
vi.mock('@/renderer/hooks/knowledge-base', () => ({
  useKnowledgeBaseList: () => ({
    personalItems: [],
    sharedItems: [],
    personalLoading: false,
    sharedLoading: false,
    loadKnowledgeBases: vi.fn(),
  }),
}));
vi.mock('@/renderer/hooks/kb-chat/useKbMentionSearch', () => ({
  useKbMentionSearch: () => ({ active: false, items: [], loading: false }),
}));
vi.mock('@/renderer/pages/conversation/explorer/search/useProjectMentionSearch', () => ({
  useProjectMentionSearch: () => ({ items: [], loading: false, active: false, peNames: {} }),
}));
vi.mock('@/renderer/components/media/FilePreview', () => ({
  default: () => null,
}));
vi.mock('@/renderer/components/media/UploadProgressBar', () => ({
  default: () => null,
}));
vi.mock('@/renderer/components/chat/AtFileMenu', () => ({
  default: () => null,
}));
vi.mock('@/renderer/components/chat/SpeechInputButton', () => ({
  default: () => null,
}));
vi.mock('../pages/guid/components/GuidWorkspaceFootnote', () => ({
  default: () => null,
}));

const noop = () => {};
const baseProps = {
  input: '@kb:研发文档 ',
  onInputChange: noop,
  onKeyDown: noop,
  onPaste: noop as unknown as React.ClipboardEventHandler,
  onFocus: noop,
  onBlur: noop,
  placeholder: 'placeholder',
  isInputActive: false,
  isFileDragging: false,
  activeBorderColor: 'transparent',
  inactiveBorderColor: 'transparent',
  activeShadow: 'none',
  dragHandlers: {},
  files: [],
  onRemoveFile: noop,
  workspaceDir: '',
  onSelectWorkspace: noop,
  onClearWorkspace: noop,
};

describe('GuidInputCard — KB highlight badge', () => {
  it('renders the @kb:<name> token as a single badge containing only the name', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} />);
    const badge = container.querySelector('[data-testid="kb-mention-badge"]');
    expect(badge).not.toBeNull();
    // The badge's text is exactly the renderer-visible token: @kb:<name>.
    // No kbId ever appears in this DOM.
    expect(badge?.textContent).toBe('@kb:研发文档');
    expect(badge?.getAttribute('title')).toContain('Cited knowledge base');
  });

  // Regression: a user typed "@kb:研发文档 设备故障内容有哪些" expecting a
  // single @-mention followed by trailing prose. The earlier rendering
  // path produced TWO `@kb:...` segments in the highlight overlay — once
  // inside the badge and again as plain text — because the badge text was
  // rendered in addition to the underlying textarea text. This test guards
  // against any re-introduction of the duplicate.
  it('does not duplicate the @kb:<name> token in the highlight overlay when typed as a single @-mention followed by prose', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const userInput = '@kb:研发文档 设备故障内容有哪些';
    const { container } = render(<GuidInputCard {...baseProps} input={userInput} />);

    const badges = container.querySelectorAll('[data-testid="kb-mention-badge"]');
    expect(badges.length).toBe(1);

    // The textarea's underlying value still contains the user's literal text
    // exactly once. The highlight layer must not have mutated `input`.
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe(userInput);
  });

  it('renders exactly two badges when input already contains two @kb tokens', async () => {
    // Guards against the scenario where a user reports "I see two KB names"
    // because their input really has two tokens — the component should
    // render one badge per token, not coalesce and not introduce extras.
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const userInput = '@kb:设备故障RCA知识库\n@kb:设备故障RCA知识库 设备故障内容有哪些';
    const { container } = render(<GuidInputCard {...baseProps} input={userInput} />);
    const badges = container.querySelectorAll('[data-testid="kb-mention-badge"]');
    expect(badges.length).toBe(2);
  });

  // Root-cause fix for the "duplicate @kb name" report: the Guid textarea
  // was rendering both its own raw text AND the highlight-overlay badges,
  // so each KB token appeared twice (once black under the textarea, once
  // blue in the badge). The chat SendBox already applies the
  // `.sendbox-highlight-textarea` class to its textarea so the underlying
  // text is transparent and only the overlay shows. The Guid variant must
  // apply the same class so the rendering is single-layered. Selection /
  // copy still works because the underlying `value` is unchanged — only
  // the displayed color is suppressed.
  it('transparently hides the textarea text so badges do not double-render', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const userInput = '@kb:研发文档 设备故障内容有哪些';
    const { container } = render(<GuidInputCard {...baseProps} input={userInput} />);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.className).toMatch(/sendbox-highlight-textarea/);
  });

  // Visual breathing room: KB badges should sit slightly indented from
  // the textarea's left edge so they don't look glued to the border.
  // A previous attempt added 8px vertical padding too, but that moved
  // the overlay baseline away from the (transparent) textarea text and
  // reintroduced the "two @kb names" double-render — vertical inset is
  // intentionally left at 0 here.
  it('offsets KB badges from the left textarea edge by 12px', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:研发文档' />);
    const layer = container.querySelector('.sendbox-highlight-layer');
    expect(layer).not.toBeNull();
    // Horizontal offset only — guard against the vertical baseline drift
    // that causes double-rendering of @kb tokens.
    expect((layer as HTMLElement | null)?.style.paddingLeft).toBe('12px');
    expect((layer as HTMLElement | null)?.style.paddingTop).toBe('');
    expect((layer as HTMLElement | null)?.style.paddingBottom).toBe('');
  });
});
