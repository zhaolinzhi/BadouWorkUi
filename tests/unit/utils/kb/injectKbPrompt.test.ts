/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildKbSystemPrompt } from '@/renderer/utils/kb/injectKbPrompt';

describe('buildKbSystemPrompt', () => {
  it('returns null for empty kbIds', () => {
    expect(buildKbSystemPrompt([])).toBeNull();
  });

  it('renders a single kbId inside an inline-code span', () => {
    const out = buildKbSystemPrompt(['uuid-1']);
    expect(out).not.toBeNull();
    expect(out).toContain('`uuid-1`');
    // The `kbIds` placeholder is fully replaced; the `{ kbIds: [...] }`
    // example in the template body is a syntax illustration and is allowed
    // to stay — what must NOT appear is the literal `{kbIds}` placeholder.
    expect(out).not.toContain('{kbIds}');
    expect(out).not.toContain('{ kbIds }');
  });

  it('joins multiple kbIds with 、 in document order', () => {
    const out = buildKbSystemPrompt(['id-1', 'id-2', 'id-3']);
    expect(out).not.toBeNull();
    expect(out).toContain('`id-1`、`id-2`、`id-3`');
    // The ids appear in the input order, not sorted.
    expect(out!.indexOf('id-1')).toBeLessThan(out!.indexOf('id-2'));
    expect(out!.indexOf('id-2')).toBeLessThan(out!.indexOf('id-3'));
  });

  it('does not include the kb- prefix from ids before composing the prompt', () => {
    // Helper is fed already-stripped ids by the hook; this test documents
    // that the rendered prompt is free of any "kb-" substring.
    const out = buildKbSystemPrompt(['uuid-1']);
    expect(out).not.toContain('kb-uuid-1');
  });

  it('contains the chatWithStream routing instructions', () => {
    const out = buildKbSystemPrompt(['uuid-1']) ?? '';
    expect(out).toContain('chatWithStream');
    expect(out).toContain('kbIds');
    expect(out).toContain('在不偏离原意的前提下');
  });
});
