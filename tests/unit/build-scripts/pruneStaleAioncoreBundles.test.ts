/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findStaleAioncoreBundleNames, pruneStaleAioncoreBundles } =
  require('../../../packages/shared-scripts/src/prune-stale-aioncore-bundles.js') as {
    findStaleAioncoreBundleNames: (existingDirNames: string[], requiredRuntimeKeys: string[]) => string[];
    pruneStaleAioncoreBundles: (
      bundledDir: string,
      requiredRuntimeKeys: string[]
    ) => { removed: string[]; kept: string[] };
  };

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('findStaleAioncoreBundleNames', () => {
  it('flags directories that the current build does not target', () => {
    // electron-builder 的 extraResources 整目录复制,残留的非目标架构会跟着进安装包。
    // electron-builder copies the whole directory via extraResources, so leftover arch dirs ride along.
    expect(findStaleAioncoreBundleNames(['darwin-x64', 'darwin-arm64'], ['darwin-x64'])).toEqual(['darwin-arm64']);
  });

  it('keeps every directory when multi-arch targets all of them', () => {
    // 多架构构建时两个目录都是需要的,不能删。
    // In a multi-arch build both directories are required and neither may be removed.
    expect(findStaleAioncoreBundleNames(['darwin-x64', 'darwin-arm64'], ['darwin-arm64', 'darwin-x64'])).toEqual([]);
  });

  it('never returns a directory that is a build target', () => {
    // 大小写或顺序不同都不该误删。
    // Neither ordering nor extra entries in the target list may cause a required dir to be dropped.
    const required = ['darwin-x64', 'darwin-arm64'];
    const found = findStaleAioncoreBundleNames(['darwin-x64', 'darwin-arm64', 'win-x64'], required);
    expect(found).toEqual(['win-x64']);
    expect(found.some((name) => required.includes(name))).toBe(false);
  });

  it('returns an empty list when nothing exists', () => {
    expect(findStaleAioncoreBundleNames([], ['darwin-x64'])).toEqual([]);
  });
});

describe('pruneStaleAioncoreBundles', () => {
  let bundledDir: string;

  beforeEach(() => {
    bundledDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-aioncore-'));
  });

  afterEach(() => {
    fs.rmSync(bundledDir, { recursive: true, force: true });
  });

  const seed = (name: string): void => {
    const dir = path.join(bundledDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'aioncore'), 'binary');
  };

  it('removes stale arch directories and leaves targets untouched', () => {
    // 复现真实故障:Intel 机器上 build:all 留下的 darwin-arm64 残骸被打进了 x64 包。
    // Reproduces the real failure: an Intel host leaves a darwin-arm64 remnant that gets packaged.
    seed('darwin-x64');
    seed('darwin-arm64');

    const result = pruneStaleAioncoreBundles(bundledDir, ['darwin-x64']);

    expect(result.removed).toEqual(['darwin-arm64']);
    expect(result.kept).toEqual(['darwin-x64']);
    expect(fs.existsSync(path.join(bundledDir, 'darwin-x64', 'aioncore'))).toBe(true);
    expect(fs.existsSync(path.join(bundledDir, 'darwin-arm64'))).toBe(false);
  });

  it('does not throw when the bundled directory does not exist yet', () => {
    // 首次构建时目录还不存在,不能因此中断打包。
    // A first build has no directory yet and must not abort packaging.
    fs.rmSync(bundledDir, { recursive: true, force: true });
    expect(pruneStaleAioncoreBundles(bundledDir, ['darwin-x64'])).toEqual({ removed: [], kept: [] });
  });

  it('leaves plain files alone and only removes directories', () => {
    // 只删目录 —— stray 文件不是本次逻辑要管的。
    // Only directories are removed; stray files are out of scope.
    seed('darwin-arm64');
    fs.writeFileSync(path.join(bundledDir, 'README.md'), 'notes');

    pruneStaleAioncoreBundles(bundledDir, ['darwin-x64']);

    expect(fs.existsSync(path.join(bundledDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(bundledDir, 'darwin-arm64'))).toBe(false);
  });
});
