/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cache signature for per-conversation row props in `WorkspaceGroupedHistory`.
 *
 * The cache (a `WeakMap<TChatConversation, …>` keyed on the conversation object)
 * lets `ConversationRow`'s `React.memo` short-circuit on unrelated parent
 * re-renders. It includes only the value-bearing props that affect the row's
 * rendered output AND participate in the row's prop identity.
 *
 * Sider-collapsed state is deliberately NOT in the signature: the row renders
 * the same tree in both states and the `.collapsed` ancestor class drives the
 * visible layout, so a sider toggle reuses the cached props and React.memo
 * skips the row entirely. This is what keeps a 10000-row conversation list
 * snappy on toggle — no per-row function execution, no subtree diff.
 *
 * Pure function so it is unit-testable without rendering.
 */
export type ConversationRowSignatureInput = {
  batchMode: boolean;
  isGenerating: boolean;
  hasCompletionUnread: boolean;
  selected: boolean;
  menuVisible: boolean;
  checked: boolean;
};

const toBit = (value: boolean): 0 | 1 => (value ? 1 : 0);

export const buildConversationRowPropsSignature = (input: ConversationRowSignatureInput): string =>
  [
    toBit(input.batchMode),
    toBit(input.isGenerating),
    toBit(input.hasCompletionUnread),
    toBit(input.selected),
    toBit(input.menuVisible),
    toBit(input.checked),
  ].join('|');
