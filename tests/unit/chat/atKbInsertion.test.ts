/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { buildKbInsertion, findAllKbTokens, KB_TOKEN_PREFIX, parseKbToken } from '@/renderer/utils/kb/atKbInsertion';

describe('atKbInsertion', () => {
  it('builds the canonical token', () => {
    expect(buildKbInsertion({ id: '42', name: 'Docs', isShared: false })).toBe('@kb:42');
  });

  it('round-trips a token', () => {
    const token = '@kb:42';
    const parsed = parseKbToken(token);
    expect(parsed).toEqual({ kind: 'kb', kbId: '42' });
  });

  it('rejects non-kb tokens', () => {
    expect(parseKbToken('@src/file.ts')).toBeNull();
    expect(parseKbToken('@kb:')).toBeNull();
    expect(parseKbToken('@KB:42')).toBeNull(); // case-sensitive prefix
  });

  it('finds tokens at start, middle and end of input', () => {
    const tokens = findAllKbTokens('hello @kb:1 and @kb:2 trailing');
    expect(tokens.map((t) => t.kbId)).toEqual(['1', '2']);
  });

  it('respects word boundaries', () => {
    expect(findAllKbTokens('foo@kb:1')).toEqual([]);
    expect(findAllKbTokens('say @kb:1!')).toHaveLength(1);
  });

  it('exposes the prefix for callers', () => {
    expect(KB_TOKEN_PREFIX).toBe('@kb:');
  });

  it('returns empty array for empty input', () => {
    expect(findAllKbTokens('')).toEqual([]);
  });

  it('captures multi-character ids and ids with hyphens/underscores', () => {
    expect(findAllKbTokens('@kb:12345')).toEqual([{ kind: 'kb', kbId: '12345' }]);
    expect(findAllKbTokens('@kb:abc-def_123 end')).toEqual([{ kind: 'kb', kbId: 'abc-def_123' }]);
  });

  it('handles a token immediately at the start of the input', () => {
    expect(findAllKbTokens('@kb:9 end')).toEqual([{ kind: 'kb', kbId: '9' }]);
  });

  it('does not match a token whose id is empty', () => {
    expect(findAllKbTokens('hello @kb: world')).toEqual([]);
  });
});
