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
});
