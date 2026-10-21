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
 * actual ids and can call `knowledge-server.chat` with the required
 * parameters. The `chat` tool takes a single `knowledgeBaseId`, so the
 * model is told to make one call per cited KB. It is invisible in the
 * textarea (the user only sees whatever text is in `input`); only the LLM
 * sees the tail.
 */

export const buildKbTailHint = (kbIds: string[], threadId: string): string | null => {
  if (kbIds.length === 0) return null;
  const formatted = kbIds.map((id) => `\`${id}\``).join('、');
  return [
    '',
    `以下是本轮引用的知识库 ID：${formatted}。`,
    '请使用 knowledge-server 这个 MCP 工具下的 chat 工具进行检索。每个知识库 ID 分别调用一次 chat（每次只传一个 knowledgeBaseId），并传入以下参数：',
    '- knowledgeBaseId：对应的知识库 ID；',
    '- userMessage：用户本轮的问题（不要包含本段提示文字）；',
    `- threadId：\`${threadId}\`（同一轮的所有 chat 调用共用此值）；`,
    '- modelCode：MiniMax-M3；',
    '- searchType：1；',
    '- enableRerank：0；',
    '- minRelevance：0.5。',
    '根据工具返回的检索内容在不偏离原意的前提下进行汇总、整理并向用户展示（请勿原样照搬大段引文；保持叙述自然）。',
  ].join('\n');
};

// Legacy alias kept so earlier one-shot consumers (e.g. reference docs) still
// resolve. New code should call `buildKbTailHint` directly.
export const buildKbSystemPrompt = buildKbTailHint;
