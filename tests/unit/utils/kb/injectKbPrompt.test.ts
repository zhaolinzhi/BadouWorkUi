/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildKbTailHint } from '@/renderer/utils/kb/injectKbPrompt';

describe('buildKbTailHint', () => {
  it('returns null for empty kbIds so callers do not modify the input', () => {
    expect(buildKbTailHint([])).toBeNull();
  });

  it('renders a single kbId inside an inline-code span', () => {
    const out = buildKbTailHint(['uuid-1']);
    expect(out).not.toBeNull();
    expect(out).toContain('`uuid-1`');
  });

  it('joins multiple kbIds with 、 in document order', () => {
    const out = buildKbTailHint(['id-1', 'id-2', 'id-3']);
    expect(out).not.toBeNull();
    expect(out).toContain('`id-1`、`id-2`、`id-3`');
    expect(out!.indexOf('id-1')).toBeLessThan(out!.indexOf('id-2'));
    expect(out!.indexOf('id-2')).toBeLessThan(out!.indexOf('id-3'));
  });

  it('does not include the kb- prefix from ids (input is already stripped)', () => {
    const out = buildKbTailHint(['uuid-1']);
    expect(out).not.toContain('kb-uuid-1');
  });

  it('contains the chatWithStream routing instructions + summarising instruction', () => {
    const out = buildKbTailHint(['uuid-1']) ?? '';
    expect(out).toContain('chatWithStream');
    expect(out).toContain('kbIds');
    expect(out).toContain('不偏离原意');
    expect(out).toContain('请使用 knowledge-server');
  });

  it('starts with a leading newline so the hint reads as a separate paragraph', () => {
    // When appended to a user message body, the leading blank line keeps
    // the hint visually separated from the user's own text. Helps the LLM
    // recognise the hint as an instruction rather than continuation.
    const out = buildKbTailHint(['uuid-1']) ?? '';
    expect(out.startsWith('\n')).toBe(true);
  });
});
