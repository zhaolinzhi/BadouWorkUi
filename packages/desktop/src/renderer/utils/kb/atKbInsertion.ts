/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import type { KnowledgeBaseItem } from '@/renderer/pages/knowledge-base/types';

export const KB_TOKEN_PREFIX = '@kb:';

/**
 * Name-based KB mention token (renderer-visible form). After the
 * "show KB name in Guid" change, the textual token in `input` is
 * `@kb:<kb.name>`; the kbId is recovered separately via a page-level
 * `GuidPage` resolver (see Task 3 of the plan) at send time, so this
 * record only carries `name`.
 */
export type KbNameToken = {
  kind: 'kb';
  name: string;
};

/**
 * Token-only form of a KB mention that carries the kbId directly.
 * Retained for legacy sessionStorage payloads (conversations created
 * before the name-form change) — `useGuidSend` runs the legacy parser
 * after the new parser as a one-shot fallback. See
 * `docs/superpowers/specs/2026-10-15-guid-kb-mention-show-name-design.md`.
 */
export type KbMentionToken = {
  kind: 'kb';
  kbId: string;
};

/** Same boundary rules as workspace `@`-mentions in `utils/chat/atFileQuery.ts`. */
const BOUNDARY_RE = /[\s,;!?()[\]{}]/;

/**
 * Renderer-visible insertion form. Stores the name so the user sees a
 * friendly label in the textarea; the kbId is recovered at send time via
 * the page-level resolver.
 */
export const buildKbInsertion = (kb: Pick<KnowledgeBaseItem, 'id' | 'name' | 'isShared'>): string =>
  `${KB_TOKEN_PREFIX}${kb.name}`;

export const parseKbNameToken = (token: string): KbNameToken | null => {
  if (!token.startsWith(KB_TOKEN_PREFIX)) return null;
  const name = token.slice(KB_TOKEN_PREFIX.length);
  if (!name) return null;
  return { kind: 'kb', name };
};

export const findAllKbNameTokens = (input: string): KbNameToken[] => {
  const out: KbNameToken[] = [];
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
    const name = input.slice(i + KB_TOKEN_PREFIX.length, end);
    if (!name) continue;
    out.push({ kind: 'kb', name });
    i = end - 1;
  }
  return out;
};

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
