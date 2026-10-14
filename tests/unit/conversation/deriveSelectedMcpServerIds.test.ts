/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { findAllKbTokens } from '@renderer/utils/kb/atKbInsertion';
import { kbIdToMcpServerId } from '@renderer/utils/kb/kbToMcpId';

const deriveSelectedMcpServerIds = (input: string, knownKbIds: Set<string>): string[] | null => {
  const tokens = findAllKbTokens(input);
  if (tokens.length === 0) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (!knownKbIds.has(token.kbId)) continue;
    const mcpId = kbIdToMcpServerId(token.kbId);
    if (!mcpId || seen.has(mcpId)) continue;
    seen.add(mcpId);
    ids.push(mcpId);
  }
  return ids.length > 0 ? ids : null;
};

describe('deriveSelectedMcpServerIds (KB -> MCP id resolution)', () => {
  it('returns null when no @kb: tokens are present', () => {
    expect(deriveSelectedMcpServerIds('just a plain question', new Set(['a']))).toBeNull();
  });

  it('forwards @kb:abc @kb:xyz as kb-abc, kb-xyz', () => {
    expect(deriveSelectedMcpServerIds('@kb:abc hello @kb:xyz', new Set(['abc', 'xyz']))).toEqual(['kb-abc', 'kb-xyz']);
  });

  it('omits the field when no @kb: tokens are present', () => {
    const result = deriveSelectedMcpServerIds('plain', new Set());
    expect(result).toBeNull();
  });

  it('drops stale @kb:gone tokens not in knownKbIds', () => {
    expect(deriveSelectedMcpServerIds('@kb:abc @kb:gone hi', new Set(['abc']))).toEqual(['kb-abc']);
  });

  it('deduplicates repeated @kb:abc tokens', () => {
    expect(deriveSelectedMcpServerIds('@kb:abc @kb:abc @kb:abc', new Set(['abc']))).toEqual(['kb-abc']);
  });
});
