/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * 知识库提及的最小字段集。
 *
 * 完整的 `KnowledgeBaseItem` 定义在 knowledge-base 子应用里
 * (`packages/microapps/knowledge-base/src/types.ts`),子应用跑在 qiankun
 * 沙箱中,shell 这边 import 不到。此处只声明真正消费的三个字段 ——
 * 多声明就是多一处会与后端契约漂移的地方。
 */
export type KbInsertionSource = {
  id: string;
  name: string;
  isShared: boolean;
};

export const KB_TOKEN_PREFIX = '@kb:';

/**
 * Token-only form of a KB mention. Only `kbId` is encoded in the `@kb:<id>`
 * token; `name` and `isShared` are resolved later by the SendBox when the
 * mention is hydrated against the live KB list.
 */
export type KbMentionToken = {
  kind: 'kb';
  kbId: string;
};

/** Same boundary rules as workspace `@`-mentions in `utils/chat/atFileQuery.ts`. */
const BOUNDARY_RE = /[\s,;!?()[\]{}]/;

export const buildKbInsertion = (kb: KbInsertionSource): string => `${KB_TOKEN_PREFIX}${kb.id}`;

export const parseKbToken = (token: string): KbMentionToken | null => {
  if (!token.startsWith(KB_TOKEN_PREFIX)) return null;
  const kbId = token.slice(KB_TOKEN_PREFIX.length);
  if (!kbId || /\s/.test(kbId)) return null;
  return { kind: 'kb', kbId };
};

export const findAllKbTokens = (input: string): KbMentionToken[] => {
  const out: KbMentionToken[] = [];
  if (!input) return out;
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== '@' || input[i + 1] !== 'k' || input[i + 2] !== 'b' || input[i + 3] !== ':') continue;
    const prev = input[i - 1];
    if (prev !== undefined && !BOUNDARY_RE.test(prev)) continue;
    let end = input.length;
    for (let j = i + KB_TOKEN_PREFIX.length; j < input.length; j += 1) {
      if (BOUNDARY_RE.test(input[j])) {
        end = j;
        break;
      }
    }
    const kbId = input.slice(i + KB_TOKEN_PREFIX.length, end);
    if (!kbId) continue;
    out.push({ kind: 'kb', kbId });
    i = end - 1;
  }
  return out;
};
