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
import { fireEvent, render } from '@testing-library/react';

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
const { kbMentionItems } = vi.hoisted(() => ({
  // Stable identity: a fresh array on every render would invalidate
  // useAtMentionItems' memo and spin the component into a render loop.
  kbMentionItems: [{ kind: 'kb' as const, path: 'kb:docs', name: 'Docs', isFile: false }],
}));

vi.mock('@/renderer/hooks/kb-chat/useKbMentionSearch', () => ({
  useKbMentionSearch: () => ({ active: true, items: kbMentionItems, loading: false }),
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

  // Regression: while the KB menu is open, keys the menu does not own must
  // still reach the textarea. Previously every non-navigation key was
  // prevented, so Backspace/Delete did nothing and an existing @kb token
  // could not be edited or removed.
  it('lets Backspace through while the KB menu is open so a selected KB can be deleted', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const onKeyDown = vi.fn();
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:Docs @kb:Wiki' onKeyDown={onKeyDown} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(4, 4); // inside the first token, after "@kb:"
    fireEvent.select(textarea);

    fireEvent.keyDown(textarea, { key: 'Backspace' });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('lets Backspace delete the bare trailing @ that just opened the KB menu', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const onKeyDown = vi.fn();
    const { container } = render(
      <GuidInputCard {...baseProps} input='@kb:Docs @kb:Wiki @' onKeyDown={onKeyDown} />
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    fireEvent.select(textarea);

    fireEvent.keyDown(textarea, { key: 'Backspace' });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('still accepts a highlighted KB on Enter and inserts a trailing space', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const onInputChange = vi.fn();
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:Do' onInputChange={onInputChange} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(6, 6);
    fireEvent.select(textarea);

    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onInputChange).toHaveBeenCalledWith('@kb:Docs ');
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

  // Geometry of the highlight layer. The layer is positioned against the
  // card's padding box, while the textarea sits in the content box, so the
  // overlay padding must reproduce the textarea's text insets: 12px card
  // padding + 7px textarea `pl-7px` on the left, and 12px card padding on
  // top. Any mismatch shows up as the caret drifting away from the visible
  // text (below it, or overlapping the last character).
  it('aligns the highlight layer with the textarea text insets', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:研发文档' />);
    const layer = container.querySelector('.sendbox-highlight-layer');
    expect(layer).not.toBeNull();
    expect((layer as HTMLElement | null)?.style.paddingLeft).toBe('19px');
    expect((layer as HTMLElement | null)?.style.paddingTop).toBe('12px');
    expect((layer as HTMLElement | null)?.style.paddingBottom).toBe('');
  });

  // The badge adds horizontal padding for its background. That padding must
  // not widen the inline flow: the textarea lays the raw token out with no
  // padding, so any extra width shifts the trailing characters away from
  // the caret. Negative margins cancel the added width while keeping the
  // visual breathing room.
  it('renders the KB badge without changing the inline flow width', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:研发文档 故障' />);
    const badge = container.querySelector('[data-testid="kb-mention-badge"]') as HTMLElement | null;
    expect(badge).not.toBeNull();
    expect(badge?.style.marginLeft).toBe('-4px');
    expect(badge?.style.marginRight).toBe('-4px');
    expect(badge?.style.paddingLeft).toBe('4px');
    expect(badge?.style.paddingRight).toBe('4px');
  });

  // Regression: a KB badge whose overlay and textarea text share the
  // same horizontal origin must render exactly once — i.e. the textarea
  // colour must still be transparent so the badge covers the underlying
  // text completely. This guards the root-cause fix from the previous
  // double-render bug.
  it('renders exactly one badge for one @kb token (no duplicate)', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} input='@kb:研发文档' />);
    const badges = container.querySelectorAll('[data-testid="kb-mention-badge"]');
    expect(badges).toHaveLength(1);
    // The textarea must still carry the transparent-text class so the
    // overlay text is the only visible layer.
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toMatch(/sendbox-highlight-textarea/);
  });

  // Regression: when the user types plain text with no `@`-mention, the
  // textarea must NOT carry `sendbox-highlight-textarea` — otherwise the
  // text colour is forced transparent and there is no overlay to render
  // the visible text, so the user sees nothing they typed (only the
  // caret blinks). The fix: toggle the class based on whether there is
  // any @-mention to drive an overlay.
  it('keeps plain text visible (no transparent-text overlay) without any @-mention', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...baseProps} input='hello world' />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).not.toMatch(/sendbox-highlight-textarea/);
  });

  // Regression: the `@kb:<name>` overlay-only rendering depends on the
  // `sendbox-highlight-textarea` class forcing the textarea text color to
  // transparent. That CSS rule lives in a separate stylesheet; if the Guid
  // page never transitively imports that stylesheet, the rule is never
  // loaded, the textarea text stays visible black, and the user sees the
  // same @kb token twice (once black underneath, once blue in the badge).
  // Guard against re-introducing the silent dependency on `SendBox` being
  // mounted: the highlight overlay CSS must be reachable from the Guid
  // component on its own.
  it('transitively imports the sendbox highlight overlay CSS so the textarea text is genuinely transparent on the Guid page', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const componentPath = path.resolve(
      __dirname,
      '../../../packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx'
    );
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Step 1: the component must import some CSS file — that CSS file is the
    // expected carrier of the highlight rules. Without it, the textarea's
    // `sendbox-highlight-textarea` class has no styling effect.
    const directCssImport = /import\s+['"][^'"]+\.css['"]/.test(componentSource);
    expect(
      directCssImport,
      'GuidInputCard.tsx must import a CSS file (transitively or directly) that carries the `.sendbox-highlight-textarea` rule. Without it, every @kb:<name> token renders twice on the Guid homepage — once as black textarea text and once as the blue overlay badge.'
    ).toBe(true);

    // Step 2: the imported CSS file must actually contain the transparent-
    // text rule. Dragging in unrelated CSS doesn't satisfy the contract.
    const importMatch = componentSource.match(/import\s+['"]([^'"]+\.css)['"]/);
    expect(importMatch).not.toBeNull();
    const importPath = importMatch?.[1] ?? '';
    // Project alias `@/...` resolves to packages/desktop/src per
    // vitest.config.ts; resolve to an absolute path regardless of
    // which alias form the import uses.
    const cssPath = importPath.startsWith('@/')
      ? path.resolve(__dirname, '../../../packages/desktop/src', importPath.slice(2))
      : path.resolve(path.dirname(componentPath), importPath);
    const cssSource = fs.readFileSync(cssPath, 'utf8');
    expect(
      cssSource.includes('sendbox-highlight-textarea'),
      `CSS file ${cssPath} must define the \`.sendbox-highlight-textarea\` rule. Otherwise the textarea text stays visible on the Guid homepage and @kb tokens double-render.`
    ).toBe(true);
    expect(
      cssSource.includes('color: transparent !important') || cssSource.includes('color:transparent !important'),
      `CSS file ${cssPath} must force the textarea text color transparent (the rule's load-bearing part). Without \`color: transparent\`, the overlay's blue badge sits on top of the same text — the very bug in this screenshot.`
    ).toBe(true);
  });

  // Regression: once an @-mention exists, the overlay takes over rendering
  // ALL of the input — including the plain prose typed after the token. The
  // overlay container is `color: transparent`, so every plain-text segment
  // depends on `.sendbox-highlight-text` supplying a visible colour. That
  // rule used to live only in SendBox's `sendbox.css`, which the Guid page
  // never imports; the result was that text typed after an @kb token was
  // invisible. The stylesheet Guid actually imports must carry the rule.
  it('defines a visible colour for overlay plain text in the stylesheet the Guid page imports', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const componentPath = path.resolve(
      __dirname,
      '../../../packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx'
    );
    const componentSource = fs.readFileSync(componentPath, 'utf8');
    const plainCssImports = [...componentSource.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)]
      .map((match) => match[1])
      .filter((importPath) => !importPath.endsWith('.module.css'));

    const repoRoot = path.resolve(__dirname, '../../../packages/desktop/src');
    const cssPaths = plainCssImports.map((importPath) =>
      importPath.startsWith('@/')
        ? path.resolve(repoRoot, importPath.slice(2))
        : path.resolve(path.dirname(componentPath), importPath)
    );

    const definitions = cssPaths.flatMap((cssPath) => {
      let cssSource: string;
      try {
        cssSource = fs.readFileSync(cssPath, 'utf8');
      } catch {
        return [];
      }
      const rule = cssSource.match(/\.sendbox-highlight-text\s*\{([^}]*)\}/);
      return rule ? [{ cssPath, body: rule[1] }] : [];
    });

    expect(
      definitions.length,
      `A non-module CSS file imported by GuidInputCard.tsx must define \`.sendbox-highlight-text\`. Scanned: ${JSON.stringify(plainCssImports)}`
    ).toBeGreaterThan(0);
    const colorDeclaration = definitions[0].body.match(/color\s*:\s*([^;]+);/);
    expect(colorDeclaration?.[1]?.trim()).toBeTruthy();
    expect(colorDeclaration?.[1]).not.toMatch(/transparent/);
  });

  // Stronger regression guard: of ALL CSS imports in GuidInputCard.tsx,
  // at least one must be a non-module CSS file that BOTH declares the
  // highlight class AND forces the textarea text to transparent. Tests on
  // only the first CSS import are wrong if the first import is a CSS
  // Modules file (`.module.css`) — those generate scoped class names and
  // never carry global rules. This stricter loop is what actually blocks
  // re-introducing the duplicate-render regression.
  it('transitively imports the sendbox highlight overlay CSS (any non-module import) so the textarea text is genuinely transparent on the Guid page', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const componentPath = path.resolve(
      __dirname,
      '../../../packages/desktop/src/renderer/pages/guid/components/GuidInputCard.tsx'
    );
    const componentSource = fs.readFileSync(componentPath, 'utf8');

    // Collect every plain-CSS import (CSS Modules are excluded because
    // they generate scoped class names and cannot carry a global rule).
    const allPlainCssImports = [...componentSource.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)].map((m) => m[1]);
    const plainCssImports = allPlainCssImports.filter((p) => !p.endsWith('.module.css'));
    expect(
      plainCssImports.length,
      `GuidInputCard.tsx must import at least one non-module CSS file. Current CSS imports: ${JSON.stringify(allPlainCssImports)}`
    ).toBeGreaterThan(0);

    const repoRoot = path.resolve(__dirname, '../../../packages/desktop/src');
    const hasHighlightCss = plainCssImports.some((importPath) => {
      const cssPath = importPath.startsWith('@/')
        ? path.resolve(repoRoot, importPath.slice(2))
        : path.resolve(path.dirname(componentPath), importPath);
      let cssSource: string;
      try {
        cssSource = fs.readFileSync(cssPath, 'utf8');
      } catch {
        return false;
      }
      return (
        cssSource.includes('sendbox-highlight-textarea') &&
        (cssSource.includes('color: transparent !important') || cssSource.includes('color:transparent !important'))
      );
    });
    expect(
      hasHighlightCss,
      `GuidInputCard.tsx must transitively import a CSS file containing both \`.sendbox-highlight-textarea\` AND \`color: transparent !important\`. CSS imports scanned: ${JSON.stringify(plainCssImports)}`
    ).toBe(true);
  });
});
