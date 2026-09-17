/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  buildConversationRowPropsSignature,
  type ConversationRowSignatureInput,
} from '@/renderer/pages/conversation/GroupedHistory/utils/rowPropsCache';

const baseSig: ConversationRowSignatureInput = {
  batchMode: false,
  isGenerating: false,
  hasCompletionUnread: false,
  selected: false,
  menuVisible: false,
  checked: false,
};

describe('buildConversationRowPropsSignature', () => {
  it('changes when batchMode flips', () => {
    const before = buildConversationRowPropsSignature({ ...baseSig, batchMode: false });
    const after = buildConversationRowPropsSignature({ ...baseSig, batchMode: true });
    expect(before).not.toBe(after);
  });

  it('is stable when none of the value-bearing inputs change', () => {
    const a = buildConversationRowPropsSignature(baseSig);
    const b = buildConversationRowPropsSignature(baseSig);
    expect(a).toBe(b);
  });

  it('changes when any of the per-row bits flip', () => {
    for (const key of ['isGenerating', 'hasCompletionUnread', 'selected', 'menuVisible', 'checked'] as const) {
      const before = buildConversationRowPropsSignature({ ...baseSig, [key]: false });
      const after = buildConversationRowPropsSignature({ ...baseSig, [key]: true });
      expect(before, key).not.toBe(after);
    }
  });
});
