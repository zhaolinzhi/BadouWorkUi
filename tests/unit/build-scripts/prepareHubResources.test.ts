/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findCachedExtensionZip, inspectHubCache, isHubCacheUsable, listCachedZipNames, readCachedHubTag } =
  require('../../../packages/shared-scripts/src/hub-resource-cache.js') as {
    findCachedExtensionZip: (hubDir: string, extensionName: string) => string | null;
    inspectHubCache: (
      hubDir: string,
      tag: string
    ) => {
      usable: boolean;
      reason: string;
      cachedTag: string | null;
      cachedFiles: string[];
      tagMatches: boolean;
    };
    isHubCacheUsable: (hubDir: string) => boolean;
    listCachedZipNames: (hubDir: string) => string[];
    readCachedHubTag: (hubDir: string) => string | null;
  };

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('inspectHubCache', () => {
  let hubDir: string;

  beforeEach(() => {
    hubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-cache-'));
  });

  afterEach(() => {
    fs.rmSync(hubDir, { recursive: true, force: true });
  });

  const seedManifest = (tag?: string, extensions?: Array<{ name: string; file: string }>): void => {
    const manifest: Record<string, unknown> = {
      generatedAt: '2026-11-23T08:50:32.475Z',
      indexUrl: 'https://example.test/index.json',
      extensions: extensions ?? [{ name: 'aionext-qwen', file: 'aionext-qwen.zip' }],
    };
    if (tag !== undefined) manifest.tag = tag;
    fs.writeFileSync(path.join(hubDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  };

  const seedZip = (name: string): string => {
    const filePath = path.join(hubDir, name);
    fs.writeFileSync(filePath, 'zip-bytes');
    return filePath;
  };

  it('reports a missing directory as unusable with reason "missing"', () => {
    // 从没准备过的目录 —— 没有任何东西可用。
    // A directory that was never prepared has nothing usable in it.
    const result = inspectHubCache(path.join(hubDir, 'nope'), 'dist-latest');

    expect(result.usable).toBe(false);
    expect(result.reason).toBe('missing');
    expect(result.cachedTag).toBeNull();
    expect(result.cachedFiles).toEqual([]);
    expect(result.tagMatches).toBe(false);
  });

  it('accepts a complete cache as usable', () => {
    // index.json + manifest.json + 至少一个 zip,三件齐全才算可用。
    // index.json + manifest.json + at least one zip — all three are required.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedManifest('dist-latest');
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.cachedTag).toBe('dist-latest');
    expect(result.tagMatches).toBe(true);
    expect(result.cachedFiles).toContain('aionext-qwen.zip');
  });

  it('rejects a cache without index.json', () => {
    // 这正是旧 bug「先删后下」失败后留下的状态:目录被清空。
    // This is exactly the state the old wipe-first bug left behind.
    seedManifest('dist-latest');
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(false);
    expect(result.reason).toBe('missing_index');
  });

  it('rejects a cache without manifest.json', () => {
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(false);
    expect(result.reason).toBe('missing_manifest');
  });

  it('rejects a cache with no extension zips', () => {
    // 只有 index 和 manifest、没有扩展 —— 缓存了个寂寞。
    // Index and manifest but no extensions — the cache would be pointless.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedManifest('dist-latest');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(false);
    expect(result.reason).toBe('missing_extensions');
  });

  it('treats a tag mismatch as usable but flagged', () => {
    // tag 不一致只是「另一个上游快照」:后端校验的是 schemaVersion 而不是 tag,
    // 所以缓存仍然可用,但差异必须被标记出来。
    // A tag mismatch means a different upstream snapshot. The backend validates
    // schemaVersion rather than the tag, so the cache stays usable — but the
    // mismatch must remain visible.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedManifest('dist-ebc6a2b');
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(true);
    expect(result.tagMatches).toBe(false);
    expect(result.cachedTag).toBe('dist-ebc6a2b');
  });

  it('treats an unknown cache tag as a mismatch', () => {
    // manifest 没有 tag 字段 = 来源不明,按不匹配处理。
    // A manifest without a tag means unknown provenance — treated as a mismatch.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedManifest(undefined);
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(true);
    expect(result.tagMatches).toBe(false);
    expect(result.cachedTag).toBeNull();
  });

  it('does not throw on a corrupt manifest.json', () => {
    // 下载写了一半留下的坏 manifest 不能让探测崩掉。
    // A half-written manifest must not crash the probe.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    fs.writeFileSync(path.join(hubDir, 'manifest.json'), 'not json');
    seedZip('aionext-qwen.zip');

    const result = inspectHubCache(hubDir, 'dist-latest');

    expect(result.usable).toBe(false);
    expect(result.reason).toBe('missing_manifest');
    expect(result.cachedTag).toBeNull();
  });

  it('never mutates the cache directory', () => {
    // 核心约束:探测是只读的。这次修的 bug 就是「探测前先把目录删了」。
    // The core constraint: probing is read-only. The bug being fixed wiped the
    // directory before probing it.
    fs.writeFileSync(path.join(hubDir, 'index.json'), JSON.stringify({ extensions: {} }));
    seedManifest('dist-latest');
    seedZip('aionext-qwen.zip');
    const before = fs.readdirSync(hubDir).toSorted();

    inspectHubCache(hubDir, 'dist-latest');

    expect(fs.readdirSync(hubDir).toSorted()).toEqual(before);
    expect(fs.existsSync(path.join(hubDir, 'index.json'))).toBe(true);
    expect(fs.existsSync(path.join(hubDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(hubDir, 'aionext-qwen.zip'))).toBe(true);
  });
});

describe('isHubCacheUsable', () => {
  let hubDir: string;

  beforeEach(() => {
    hubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-usable-'));
  });

  afterEach(() => {
    fs.rmSync(hubDir, { recursive: true, force: true });
  });

  it('is false for a non-existent directory', () => {
    expect(isHubCacheUsable(path.join(hubDir, 'nope'))).toBe(false);
  });

  it('is true only when index, manifest and a zip are all present', () => {
    fs.writeFileSync(path.join(hubDir, 'index.json'), '{}');
    fs.writeFileSync(path.join(hubDir, 'manifest.json'), JSON.stringify({ tag: 'dist-latest' }));
    fs.writeFileSync(path.join(hubDir, 'aionext-qwen.zip'), 'zip');

    expect(isHubCacheUsable(hubDir)).toBe(true);

    fs.rmSync(path.join(hubDir, 'aionext-qwen.zip'));
    expect(isHubCacheUsable(hubDir)).toBe(false);
  });
});

describe('readCachedHubTag', () => {
  let hubDir: string;

  beforeEach(() => {
    hubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-tag-'));
  });

  afterEach(() => {
    fs.rmSync(hubDir, { recursive: true, force: true });
  });

  it('returns the tag recorded in the manifest', () => {
    fs.writeFileSync(path.join(hubDir, 'manifest.json'), JSON.stringify({ tag: 'dist-ebc6a2b' }));

    expect(readCachedHubTag(hubDir)).toBe('dist-ebc6a2b');
  });

  it('returns null when the manifest is missing or unreadable', () => {
    expect(readCachedHubTag(hubDir)).toBeNull();

    fs.writeFileSync(path.join(hubDir, 'manifest.json'), 'not json');
    expect(readCachedHubTag(hubDir)).toBeNull();
  });
});

describe('findCachedExtensionZip', () => {
  let hubDir: string;

  beforeEach(() => {
    hubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-zip-'));
  });

  afterEach(() => {
    fs.rmSync(hubDir, { recursive: true, force: true });
  });

  it('finds the zip by the file name recorded in the manifest', () => {
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({ extensions: [{ name: 'aionext-qwen', file: 'aionext-qwen.zip' }] })
    );
    const zipPath = path.join(hubDir, 'aionext-qwen.zip');
    fs.writeFileSync(zipPath, 'zip');

    expect(findCachedExtensionZip(hubDir, 'aionext-qwen')).toBe(zipPath);
  });

  it('falls back to <name>.zip when the manifest has no matching entry', () => {
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({ extensions: [{ name: 'aionext-opencode', file: 'aionext-opencode.zip' }] })
    );
    const zipPath = path.join(hubDir, 'aionext-qwen.zip');
    fs.writeFileSync(zipPath, 'zip');

    expect(findCachedExtensionZip(hubDir, 'aionext-qwen')).toBe(zipPath);
  });

  it('returns null when no cached zip exists for the extension', () => {
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({ extensions: [{ name: 'aionext-opencode', file: 'aionext-opencode.zip' }] })
    );
    fs.writeFileSync(path.join(hubDir, 'aionext-opencode.zip'), 'zip');

    expect(findCachedExtensionZip(hubDir, 'aionext-qwen')).toBeNull();
  });

  it('looks the extension up by manifest entry rather than by file name', () => {
    // 上游的 tarball 名可能和扩展名不一致 —— 必须按 manifest 条目找。
    // The upstream tarball name may differ from the extension name — the
    // manifest entry is the authoritative mapping.
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({ extensions: [{ name: 'aionext-qwen', file: 'custom-pack.zip' }] })
    );
    const zipPath = path.join(hubDir, 'custom-pack.zip');
    fs.writeFileSync(zipPath, 'zip');

    expect(findCachedExtensionZip(hubDir, 'aionext-qwen')).toBe(zipPath);
  });
});

describe('listCachedZipNames', () => {
  let hubDir: string;

  beforeEach(() => {
    hubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-list-'));
  });

  afterEach(() => {
    fs.rmSync(hubDir, { recursive: true, force: true });
  });

  it('lists the zips recorded in the manifest', () => {
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({
        extensions: [
          { name: 'aionext-qwen', file: 'aionext-qwen.zip' },
          { name: 'aionext-opencode', file: 'aionext-opencode.zip' },
        ],
      })
    );
    fs.writeFileSync(path.join(hubDir, 'aionext-qwen.zip'), 'zip');
    fs.writeFileSync(path.join(hubDir, 'aionext-opencode.zip'), 'zip');

    expect(listCachedZipNames(hubDir)).toEqual(['aionext-qwen.zip', 'aionext-opencode.zip']);
  });

  it('omits manifest entries whose zip is no longer on disk', () => {
    // manifest 是上一次成功下载时写的,可能和磁盘状态不一致。
    // The manifest was written by a previous successful download and may be out
    // of sync with the disk — a claimed-but-absent zip must not be listed.
    fs.writeFileSync(
      path.join(hubDir, 'manifest.json'),
      JSON.stringify({
        extensions: [
          { name: 'aionext-qwen', file: 'aionext-qwen.zip' },
          { name: 'aionext-opencode', file: 'aionext-opencode.zip' },
        ],
      })
    );
    fs.writeFileSync(path.join(hubDir, 'aionext-qwen.zip'), 'zip');

    expect(listCachedZipNames(hubDir)).toEqual(['aionext-qwen.zip']);
  });

  it('falls back to scanning the directory when the manifest is missing', () => {
    fs.writeFileSync(path.join(hubDir, 'aionext-qwen.zip'), 'zip');
    fs.writeFileSync(path.join(hubDir, 'aionext-opencode.zip'), 'zip');
    fs.writeFileSync(path.join(hubDir, 'README.md'), 'notes');

    const names = listCachedZipNames(hubDir);

    expect(names).toContain('aionext-qwen.zip');
    expect(names).toContain('aionext-opencode.zip');
    expect(names).not.toContain('README.md');
  });

  it('returns an empty list for a directory that does not exist', () => {
    expect(listCachedZipNames(path.join(hubDir, 'nope'))).toEqual([]);
  });
});
