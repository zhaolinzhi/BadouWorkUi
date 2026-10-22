/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildKbTailHint } from '@/renderer/utils/kb/injectKbPrompt';

describe('buildKbTailHint', () => {
  it('returns null for empty kbIds so callers do not modify the input', () => {
    expect(buildKbTailHint([], 'thread-1')).toBeNull();
  });

  it('renders a single kbId inside an inline-code span', () => {
    const out = buildKbTailHint(['uuid-1'], 'thread-1');
    expect(out).not.toBeNull();
    expect(out).toContain('`uuid-1`');
  });

  it('joins multiple kbIds with 、 in document order', () => {
    const out = buildKbTailHint(['id-1', 'id-2', 'id-3'], 'thread-1');
    expect(out).not.toBeNull();
    expect(out).toContain('`id-1`、`id-2`、`id-3`');
    expect(out!.indexOf('id-1')).toBeLessThan(out!.indexOf('id-2'));
    expect(out!.indexOf('id-2')).toBeLessThan(out!.indexOf('id-3'));
  });

  it('does not include the kb- prefix from ids (input is already stripped)', () => {
    const out = buildKbTailHint(['uuid-1'], 'thread-1');
    expect(out).not.toContain('kb-uuid-1');
  });

  it('routes through the knowledge-server chat tool (not chatWithStream)', () => {
    const out = buildKbTailHint(['uuid-1'], 'thread-1') ?? '';
    expect(out).toContain('请使用 knowledge-server');
    expect(out).toContain('chat 工具');
    expect(out).not.toContain('chatWithStream');
    expect(out).not.toContain('kbIds');
    expect(out).toContain('不偏离原意');
  });

  it('asks for one chat call per knowledge base with a single knowledgeBaseId', () => {
    const out = buildKbTailHint(['id-1', 'id-2'], 'thread-1') ?? '';
    expect(out).toContain('每个知识库 ID 分别调用一次');
    expect(out).toContain('knowledgeBaseId');
  });

  it('passes every required chat parameter, including the shared threadId', () => {
    const out = buildKbTailHint(['uuid-1'], 'thread-abc') ?? '';
    expect(out).toContain('userMessage');
    expect(out).toContain('threadId：`thread-abc`');
    expect(out).toContain('modelCode：MiniMax-M3');
    expect(out).toContain('searchType：1');
    expect(out).toContain('enableRerank：0');
    expect(out).toContain('minRelevance：0.5');
  });

  it('starts with a leading newline so the hint reads as a separate paragraph', () => {
    // When appended to a user message body, the leading blank line keeps
    // the hint visually separated from the user's own text. Helps the LLM
    // recognise the hint as an instruction rather than continuation.
    const out = buildKbTailHint(['uuid-1'], 'thread-1') ?? '';
    expect(out.startsWith('\n')).toBe(true);
  });
});
