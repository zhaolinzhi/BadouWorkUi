/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getContentType, resolveMicroAppAssetPath, resolveMicroAppAssetRoot } from '../assets';

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

describe('resolveMicroAppAssetRoot', () => {
  // app.getAppPath() 在两种形态下指向完全不同的东西:打包后是 app.asar 根,
  // 未打包时是入口文件所在目录(out/main)。两个都要能落到同一个 out/renderer/microapps。
  // app.getAppPath() points somewhere different per shape: the app.asar root when
  // packaged, the entry file's directory (out/main) when not. Both must land on the
  // same out/renderer/microapps.
  const existsOnly =
    (...present: string[]): ((p: string) => boolean) =>
    (p) =>
      present.includes(p);

  it('uses the app path directly when it already holds the assets', () => {
    // 打包形态:appPath 即 asar 根,子目录就在它下面。
    const appPath = path.resolve('/Applications/BadouWorklocal.app/Contents/Resources/app.asar');
    const expected = path.join(appPath, 'out/renderer/microapps');

    expect(resolveMicroAppAssetRoot(appPath, existsOnly(expected))).toBe(expected);
  });

  it('steps back to the project root when the app path is the entry directory', () => {
    // 未打包形态:appPath 是 out/main,真实产物在仓库根下。
    const appPath = path.resolve('/repo/out/main');
    const expected = path.resolve('/repo/out/renderer/microapps');

    expect(resolveMicroAppAssetRoot(appPath, existsOnly(expected))).toBe(expected);
  });

  it('prefers the app path candidate over the project root candidate', () => {
    // 两个候选都在时优先取靠前的那个 —— 打包形态优先于开发形态。
    // With both candidates present the earlier one wins: packaged shape beats the dev shape.
    const appPath = path.resolve('/repo/out/main');
    const first = path.join(appPath, 'out/renderer/microapps');
    const second = path.resolve('/repo/out/renderer/microapps');

    expect(resolveMicroAppAssetRoot(appPath, existsOnly(first, second))).toBe(first);
  });

  it('falls back to the app path candidate when nothing has been built yet', () => {
    // 一次 prepare 都没跑过(纯 bun run dev)时目录不存在,保持首个候选,
    // handler 会干净地回 404 —— 不能因此抛错或返回 undefined。
    // With nothing built (plain `bun run dev`) the directory is absent; keep the first
    // candidate so the handler answers 404 instead of throwing or yielding undefined.
    const appPath = path.resolve('/repo/out/main');

    expect(resolveMicroAppAssetRoot(appPath, () => false)).toBe(path.join(appPath, 'out/renderer/microapps'));
  });

  it('never returns a path outside the two candidate shapes', () => {
    // 回归护栏:任何输入都必须落到以 appPath 或其祖父为基准的位置。
    // Regression guard: every input lands somewhere anchored to appPath or its grandparent.
    const appPath = path.resolve('/repo/out/main');
    const root = resolveMicroAppAssetRoot(appPath, existsOnly(path.resolve('/repo/out/renderer/microapps')));

    expect(path.normalize(root).startsWith(path.normalize(path.resolve('/repo')))).toBe(true);
  });
});
