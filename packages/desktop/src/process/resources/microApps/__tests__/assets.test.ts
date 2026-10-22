/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getContentType, resolveMicroAppAssetPath } from '../assets';

// 路径解析跑在 node env 下；根目录用 POSIX 风格常量，断言时用 path.resolve 归一化，
// 避免 Windows 上分隔符不同导致用例假失败。
// Path resolution runs in the node env; the root is a POSIX-style constant and assertions
// normalise through path.resolve so the suite does not fail on Windows separators.
const ROOT = path.resolve('/app/out/renderer/microapps');

describe('resolveMicroAppAssetPath', () => {
  it('resolves a normal micro app entry to a path under the root', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/index.html')).toBe(path.join(ROOT, 'notes/index.html'));
  });

  it('resolves a hashed asset', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/assets/index-CkAN_3Be.js')).toBe(
      path.join(ROOT, 'notes/assets/index-CkAN_3Be.js')
    );
  });

  it('treats a repeated leading slash as the same path', () => {
    expect(resolveMicroAppAssetPath(ROOT, '//notes/index.html')).toBe(path.join(ROOT, 'notes/index.html'));
  });

  it('decodes percent-encoded segments', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/%E7%AC%94%E8%AE%B0%E6%9C%AC.html')).toBe(
      path.join(ROOT, 'notes/笔记本.html')
    );
  });

  it('rejects a traversal spelled with literal dots', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/../../secret.txt')).toBeNull();
  });

  it('rejects a traversal spelled with percent-encoded dots', () => {
    // pathname 里的 %2e%2e 就是 ..；先 decode 再挡才拦得住，顺序反了等于没拦。
    // %2e%2e in a pathname is `..`; only decoding before the check actually blocks it.
    expect(resolveMicroAppAssetPath(ROOT, '/notes/%2e%2e/%2e%2e/secret.txt')).toBeNull();
  });

  it('rejects a traversal that escapes into an asar sibling', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/../../renderer/index.html')).toBeNull();
  });

  it('keeps an absolute-looking path inside the root instead of honouring it', () => {
    // 直接 path.resolve(root, '/etc/passwd') 会把 root 顶掉，拿到真的 /etc/passwd。
    // Calling path.resolve(root, '/etc/passwd') outright would replace root and yield the
    // real /etc/passwd; the path has to be confined under the root instead.
    expect(resolveMicroAppAssetPath(ROOT, '/etc/passwd')).toBe(path.join(ROOT, 'etc/passwd'));
  });

  it('accepts a file whose name merely starts with dots', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/.vite/manifest.json')).toBe(
      path.join(ROOT, 'notes/.vite/manifest.json')
    );
  });

  it('rejects malformed percent-encoding', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/%E0%A4%A')).toBeNull();
  });

  it('rejects an embedded NUL', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/notes/index.html%00.png')).toBeNull();
  });

  it('rejects the root itself', () => {
    expect(resolveMicroAppAssetPath(ROOT, '/')).toBeNull();
  });
});

describe('getContentType', () => {
  it('maps the types a micro app build emits', () => {
    expect(getContentType('notes/index.html')).toBe('text/html; charset=utf-8');
    expect(getContentType('notes/assets/index-abc.js')).toBe('text/javascript; charset=utf-8');
    expect(getContentType('notes/assets/index-abc.css')).toBe('text/css; charset=utf-8');
    expect(getContentType('notes/assets/logo.svg')).toBe('image/svg+xml');
    expect(getContentType('notes/assets/icon.woff2')).toBe('font/woff2');
  });

  it('ignores case of the extension', () => {
    expect(getContentType('notes/assets/LOGO.PNG')).toBe('image/png');
  });

  it('falls back to octet-stream for anything unknown', () => {
    expect(getContentType('notes/assets/blob.unknown')).toBe('application/octet-stream');
    expect(getContentType('notes/LICENSE')).toBe('application/octet-stream');
  });
});
