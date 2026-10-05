import CryptoJS from 'crypto-js';

const SECRET = 'izMNRXR9Cx96fTiE';

export function aesEncrypt(plaintext: string): string {
  const data = CryptoJS.enc.Utf8.parse(plaintext);
  const key = CryptoJS.enc.Utf8.parse(SECRET);
  const iv = CryptoJS.enc.Utf8.parse(SECRET);
  const encrypted = CryptoJS.AES.encrypt(data, key, { iv, mode: CryptoJS.mode.CBC });
  return CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
}

export function aesDecrypt(ciphertext: string): string {
  const key = CryptoJS.enc.Utf8.parse(SECRET);
  const iv = CryptoJS.enc.Utf8.parse(SECRET);
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, { iv, mode: CryptoJS.mode.CBC });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 解密 aipaas `maskForCurrent` 返回的 NewAPI Key 密文。
 *
 * 与项目里的 `aesDecrypt` 不同,aipaas 端使用 `AES/CBC/NoPadding` + 手工补 NUL
 * (0x00) 到 16 字节倍数(文档 §3.1),所以这里显式指定 `padding: NoPadding`,
 * 并在解密后 `replace(/\0+$/, '')` 去掉末尾的零填充。
 * 直接复用 `aesDecrypt` 会得到带 PKCS7 解析错误的乱码。
 *
 * 注:aipaas 端解密后调 Java `String.trim()`,也能兼容末尾是空格(0x20)的情况;
 * 如果未来实测发现 aipaas 实际填充字节是 0x20,把末尾的 `replace(/\0+$/, '')`
 * 换成 `replace(/[\s\x00]+$/, '')` 即可,无需改动调用方。
 *
 * @param enc aipaas 返回的 AES/CBC/NoPadding Base64 密文
 * @returns 明文 key(已去除末尾 NUL 填充);失败返回 null,不抛
 */
export function decryptNewapiKey(enc: string): string | null {
  if (!enc) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse(SECRET);
    const iv = CryptoJS.enc.Utf8.parse(SECRET);
    const decrypted = CryptoJS.AES.decrypt(enc, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.NoPadding,
    });
    const utf8 = decrypted.toString(CryptoJS.enc.Utf8);
    return utf8.replace(/\0+$/, '');
  } catch {
    return null;
  }
}
