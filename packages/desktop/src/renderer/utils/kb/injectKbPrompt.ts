/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds the hidden Chinese system-prompt hint that the Guid renderer
 * attaches to an assistant turn when the user has @-mentioned one or
 * more knowledge bases. The hint instructs the LLM to route the
 * question through knowledge-server.chatWithStream and summarise the
 * result faithfully.
 *
 * Lives as a pure helper so it is unit-testable without rendering
 * React. The hint is Chinese-only for now (current requirement). If
 * multi-locale support is added later, lift the template into a locale
 * module.
 */

const KB_PROMPT_TEMPLATE = `用户在本轮消息中通过 @知识库 功能引用了以下知识库：
- {kbIds}

请使用 knowledge-server 这个 MCP 工具下的 chatWithStream 工具，将上列知识库 ID 一并传入（合并为单次调用，传入形如 { kbIds: [...] }），用用户的问题作为 query；
根据工具返回的检索内容在不偏离原意的前提下进行汇总、整理并向用户展示（请勿原样照搬大段引文；保持叙述自然）。`;

export const buildKbSystemPrompt = (kbIds: string[]): string | null => {
  if (kbIds.length === 0) return null;
  const formatted = kbIds.map((id) => `\`${id}\``).join('、');
  return KB_PROMPT_TEMPLATE.replace('{kbIds}', formatted);
};
