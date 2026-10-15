/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import {
  buildKbInsertion,
  findAllKbNameTokens,
  findAllKbTokens,
  KB_TOKEN_PREFIX,
  parseKbNameToken,
  parseKbToken,
} from '@/renderer/utils/kb/atKbInsertion';

describe('atKbInsertion', () => {
  it('builds the canonical token from the KB name (renderer-visible form)', () => {
    // After the guid-renderer "show name" change, the token carries the name —
    // the kbId is recovered from a separate page-level resolver at send time.
    expect(buildKbInsertion({ id: '42', name: 'Docs', isShared: false })).toBe('@kb:Docs');
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

describe('atKbInsertion — name-based parser', () => {
  it('parseKbNameToken extracts the suffix as a name', () => {
    expect(parseKbNameToken('@kb:研发文档')).toEqual({ kind: 'kb', name: '研发文档' });
    expect(parseKbNameToken('@kb:42')).toEqual({ kind: 'kb', name: '42' });
  });

  it('parseKbNameToken rejects non-kb tokens and empty suffixes', () => {
    expect(parseKbNameToken('@src/file.ts')).toBeNull();
    expect(parseKbNameToken('@kb:')).toBeNull();
    expect(parseKbNameToken('@KB:Docs')).toBeNull(); // case-sensitive prefix
  });

  it('findAllKbNameTokens extracts names at boundaries', () => {
    expect(findAllKbNameTokens('参见 @kb:研发文档 与 @kb:工作手册,谢谢')).toEqual([
      { kind: 'kb', name: '研发文档' },
      { kind: 'kb', name: '工作手册' },
    ]);
  });

  it('findAllKbNameTokens honors the same boundary regex as the legacy parser', () => {
    // Whitespace is a token terminator (matches `findAllKbTokens` semantics);
    // KB names with spaces split at the first space, consistent with the
    // pre-existing id-form parser.
    expect(findAllKbNameTokens('foo@kb:Docs')).toEqual([]); // no leading boundary
    expect(findAllKbNameTokens('请查 @kb:产品 v2')).toEqual([{ kind: 'kb', name: '产品' }]);
  });

  it('findAllKbNameTokens returns [] for empty input', () => {
    expect(findAllKbNameTokens('')).toEqual([]);
  });

  it('findAllKbNameTokens skips tokens whose suffix is empty', () => {
    expect(findAllKbNameTokens('hello @kb: world')).toEqual([]);
  });
});
