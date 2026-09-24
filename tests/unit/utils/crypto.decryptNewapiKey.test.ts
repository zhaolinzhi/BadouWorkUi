import { describe, expect, it } from 'vitest';
import CryptoJS from 'crypto-js';
import { decryptNewapiKey } from '@/renderer/utils/crypto';

// aipaas 端的"手工补零"实际就是:把明文 pad 到 16 字节倍数,填充字节是 0x00,
// 然后用 AES-128-CBC / NoPadding 加密,结果以 Base64 输出。
// 文档(2026-09-24-newapi-key-typescript-integration.md §3.1)称之为"手工补零"。
// Java 端解密后调 `String.trim()` 取末尾零字节。

const SECRET = 'izMNRXR9Cx96fTiE';
const KEY = CryptoJS.enc.Utf8.parse(SECRET);
const IV = CryptoJS.enc.Utf8.parse(SECRET);

/** 模拟 aipaas `Encryption.aesEncrypt`:NUL-padded + AES-128-CBC / NoPadding + Base64 */
function aipaasLikeEncrypt(plain: string): string {
  const data = Buffer.from(plain, 'utf-8');
  const block = 16;
  const target = data.length + (block - (data.length % block));
  const padded = Buffer.alloc(target, 0x00);
  padded.set(data, 0);
  const cipher = CryptoJS.AES.encrypt(CryptoJS.lib.WordArray.create(padded), KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
  });
  return CryptoJS.enc.Base64.stringify(cipher.ciphertext);
}

describe('decryptNewapiKey', () => {
  it('decrypts an aipaas-like NUL-padded ciphertext back to the original plaintext', () => {
    const plain = 'sk-test-1234567890abcdef';
    const enc = aipaasLikeEncrypt(plain);
    expect(decryptNewapiKey(enc)).toBe(plain);
  });

  it('strips trailing zero padding bytes from non-block-aligned plaintext', () => {
    const enc = aipaasLikeEncrypt('sk-odd'); // 6 字节,加密后密文含 10 个 NUL 填充
    const result = decryptNewapiKey(enc);
    expect(result).toBe('sk-odd');
    expect(result?.endsWith('\0')).toBe(false);
  });

  it('returns null when input is empty string', () => {
    expect(decryptNewapiKey('')).toBeNull();
  });

  it('returns null or string when input is not valid base64 / ciphertext (does not throw)', () => {
    // 故意塞非法字符;crypto-js 可能不抛但会返回乱码,要求至少不抛且返回 string|null
    const result = decryptNewapiKey('!!!not-valid-base64!!!');
    expect(result === null || typeof result === 'string').toBe(true);
  });
});