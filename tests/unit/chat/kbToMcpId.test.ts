import { describe, expect, it } from 'vitest';
import { kbIdToMcpServerId, mcpServerIdToKbId } from '@/renderer/utils/kb/kbToMcpId';

describe('kbToMcpId', () => {
  it('prefixes a plain id', () => {
    expect(kbIdToMcpServerId('abc')).toBe('kb-abc');
  });
  it('round-trips', () => {
    expect(mcpServerIdToKbId(kbIdToMcpServerId('faq-001'))).toBe('faq-001');
  });
  it('accepts already-prefixed ids (idempotent)', () => {
    expect(kbIdToMcpServerId('kb-abc')).toBe('kb-abc');
  });
  it('rejects empty', () => {
    expect(kbIdToMcpServerId('')).toBeNull();
    expect(mcpServerIdToKbId('')).toBeNull();
  });
  it('rejects ids containing whitespace', () => {
    expect(kbIdToMcpServerId('a b')).toBeNull();
    expect(mcpServerIdToKbId('kb-a b')).toBeNull();
  });
  it('rejects ids that do not start with kb- on the reverse path', () => {
    expect(mcpServerIdToKbId('mcp-foo')).toBeNull();
  });
});
