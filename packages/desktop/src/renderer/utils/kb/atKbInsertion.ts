/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import type { KnowledgeBaseItem } from '@/renderer/pages/knowledge-base/types';
import { kbIdToMcpServerId } from './kbToMcpId';

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

/**
 * Convert the renderer-visible `@kb:<name>` tokens in `input` into MCP server
 * ids (`kb-<id>`), using `resolveKbId` to recover the kbId.
 *
 * Each token is tried against both `isShared: false` and `isShared: true`
 * keys, so a single KB name appearing in either personal or shared lists
 * resolves; first hit wins. Stale tokens whose name is no longer in the
 * resolver are dropped silently — same contract as the legacy id-based path.
 *
 * Accepts an optional list of `legacyKbTokens` (e.g. decoded via
 * `findAllKbTokens`) to retain back-compat for in-flight sessionStorage
 * drafts that still carry the old `@kb:<id>` text. Legacy tokens are
 * appended only when their kbId is in `knownKbIds`.
 */
export const extractKbMcpServerIdsFromInput = (
  input: string,
  resolveKbId: (name: string, isShared: boolean) => string | undefined,
  options?: { legacyKbTokens?: KbMentionToken[]; knownKbIds?: Iterable<string> }
): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of findAllKbNameTokens(input)) {
    const id = resolveKbId(t.name, false) ?? resolveKbId(t.name, true);
    if (!id) continue;
    const mcp = kbIdToMcpServerId(id);
    if (!mcp || seen.has(mcp)) continue;
    seen.add(mcp);
    out.push(mcp);
  }
  if (options?.legacyKbTokens && options.legacyKbTokens.length > 0) {
    const known = options.knownKbIds ? new Set(options.knownKbIds) : null;
    for (const t of options.legacyKbTokens) {
      if (known && !known.has(t.kbId)) continue;
      const mcp = kbIdToMcpServerId(t.kbId);
      if (!mcp || seen.has(mcp)) continue;
      seen.add(mcp);
      out.push(mcp);
    }
  }
  return out;
};
