/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildKbTailHint } from '@/renderer/utils/kb/injectKbPrompt';

const THREAD_ID = 'thread-abc';

describe('buildKbTailHint', () => {
  it('returns null for empty kbIds so callers do not modify the input', () => {
    expect(buildKbTailHint([], THREAD_ID)).toBeNull();
  });

  it('renders a single kbId inside an inline-code span', () => {
    const out = buildKbTailHint(['uuid-1'], THREAD_ID);
    expect(out).not.toBeNull();
    expect(out).toContain('`uuid-1`');
  });

  it('joins multiple kbIds with 、 in document order', () => {
    const out = buildKbTailHint(['id-1', 'id-2', 'id-3'], THREAD_ID);
    expect(out).not.toBeNull();
    expect(out).toContain('`id-1`、`id-2`、`id-3`');
    expect(out!.indexOf('id-1')).toBeLessThan(out!.indexOf('id-2'));
    expect(out!.indexOf('id-2')).toBeLessThan(out!.indexOf('id-3'));
  });

  it('does not include the kb- prefix from ids (input is already stripped)', () => {
    const out = buildKbTailHint(['uuid-1'], THREAD_ID);
    expect(out).not.toBeNull();
    expect(out).not.toContain('kb-uuid-1');
  });

  // The knowledge-server MCP exposes `chat`, not the old `chatWithStream`.
  // It takes a single knowledgeBaseId, so the model is told to make one call
  // per cited KB and to pass the arguments the tool actually declares.
  it('routes the model to the knowledge-server chat tool', () => {
    const out = buildKbTailHint(['uuid-1'], THREAD_ID) ?? '';
    expect(out).toContain('请使用 knowledge-server');
    expect(out).toContain('chat 工具');
    expect(out).not.toContain('chatWithStream');
  });

  it('names every argument the chat tool requires', () => {
    // A missing argument makes the gateway answer HTTP 400 and the model
    // retries blindly, so each one the schema declares must be spelled out.
    const out = buildKbTailHint(['uuid-1'], THREAD_ID) ?? '';
    expect(out).toContain('knowledgeBaseId');
    expect(out).toContain('userMessage');
    expect(out).toContain('threadId');
    expect(out).toContain('modelCode');
    expect(out).toContain('searchType');
    expect(out).toContain('enableRerank');
    expect(out).toContain('minRelevance');
  });

  it('passes the threadId through so calls in one turn share it', () => {
    const out = buildKbTailHint(['uuid-1'], 'thread-xyz') ?? '';
    expect(out).toContain('`thread-xyz`');
  });

  it('keeps the summarising instruction so the model answers rather than dumps', () => {
    const out = buildKbTailHint(['uuid-1'], THREAD_ID) ?? '';
    expect(out).toContain('不偏离原意');
  });

  it('starts with a leading newline so the hint reads as a separate paragraph', () => {
    // When appended to a user message body, the leading blank line keeps
    // the hint visually separated from the user's own text. Helps the LLM
    // recognise the hint as an instruction rather than continuation.
    const out = buildKbTailHint(['uuid-1'], THREAD_ID) ?? '';
    expect(out.startsWith('\n')).toBe(true);
  });
});
