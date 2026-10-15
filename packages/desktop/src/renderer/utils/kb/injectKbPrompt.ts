/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds the hidden Chinese hint that the Guid renderer appends to the
 * user message body when the user has @-mentioned one or more knowledge
 * bases. The hint reaches the LLM via the user-message channel (the
 * backend agent framework does not yet read a per-conversation system
 * prompt slot, so a system-prompt override would be a no-op).
 *
 * Returns `null` when `kbIds` is empty — the caller treats `null` as
 * "do not modify the input".
 *
 * The hint lists the kbIds in an inline-code list so the model sees the
 * actual ids and can call `knowledge-server.chatWithStream({ kbIds: [...] }, query)`
 * with the right argument. It is invisible in the textarea (the user only
 * sees whatever text is in `input`); only the LLM sees the tail.
 */

export const buildKbTailHint = (kbIds: string[]): string | null => {
  if (kbIds.length === 0) return null;
  const formatted = kbIds.map((id) => `\`${id}\``).join('、');
  return [
    '',
    `以下是本轮引用的知识库 ID：${formatted}。`,
    '请使用 knowledge-server 这个 MCP 工具下的 chatWithStream 工具，将上列知识库 ID 一并传入（合并为单次调用，传入形如 { kbIds: [...] }），用用户的问题作为 query；',
    '根据工具返回的检索内容在不偏离原意的前提下进行汇总、整理并向用户展示（请勿原样照搬大段引文；保持叙述自然）。',
  ].join('\n');
};

// Legacy alias kept so earlier one-shot consumers (e.g. reference docs) still
// resolve. New code should call `buildKbTailHint` directly.
export const buildKbSystemPrompt = buildKbTailHint;
