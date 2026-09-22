/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import type { KnowledgeBaseItem } from '@/renderer/pages/knowledge-base/types';

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

const isBoundary = (char: string | undefined): boolean => char === undefined || BOUNDARY_RE.test(char);

export const buildKbInsertion = (kb: Pick<KnowledgeBaseItem, 'id' | 'name' | 'isShared'>): string =>
  `${KB_TOKEN_PREFIX}${kb.id}`;

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
    if (!isBoundary(input[i - 1])) continue;
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
