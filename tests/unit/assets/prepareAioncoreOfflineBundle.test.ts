import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const { prepareAioncore } = require('../../../packages/shared-scripts/src/prepare-aioncore');
const {
  resolveOfflineAioncoreBundle,
} = require('../../../packages/shared-scripts/src/resolve-offline-aioncore-bundle');

const RUNTIME_KEY = 'darwin-x64';
const BINARY_NAME = 'aioncore';

function writeFile(filePath: string, contents = 'x') {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

/**
 * 造一份"完整可用"的 aioncore 整包。
 *
 * 三个要件缺一不可：二进制本体、`managed-resources/` 的契约、整包 manifest ——
 * `verifyBundledAioncoreResources` 会逐项检查。
 */
function createCompleteBundle(dir: string, { version = 'v0.1.63', platform = 'darwin', arch = 'x64' } = {}) {
  writeFile(join(dir, BINARY_NAME), 'fake-binary');
  chmodSync(join(dir, BINARY_NAME), 0o755);
  writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify({ platform, arch, version, sourceType: 'cache', files: [BINARY_NAME, 'managed-resources/'] })
  );
  writeFile(
    join(dir, 'managed-resources', 'manifest.json'),
    JSON.stringify({
      schemaVersion: 2,
      runtimeKey: `${platform}-${arch}`,
      node: { version: '24.11.0', root: 'node/node-v24.11.0', executable: 'bin/node' },
      clis: [],
    })
  );
  writeFile(join(dir, 'managed-resources', 'node', 'node-v24.11.0', 'bin', 'node'), 'fake-node');
}

const createdDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.AIONUI_BACKEND_LOCAL_BUNDLE_DIR;
  delete process.env.AIONUI_BACKEND_LOCAL_BINARY;
  delete process.env.AIONUI_BACKEND_RUN_ID;
  while (createdDirs.length > 0) {
    rmSync(createdDirs.pop() as string, { recursive: true, force: true });
  }
});

describe('离线 aioncore 整包探测', () => {
  it('从已装应用目录里找到版本一致的完整整包', () => {
    const appRoot = makeTempDir('aionui-offline-app-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(bundleDir);

    const resolved = resolveOfflineAioncoreBundle({
      projectRoot: makeTempDir('aionui-offline-project-'),
      platform: 'darwin',
      arch: 'x64',
      version: 'v0.1.63',
      appRoots: [appRoot],
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.kind).toBe('installed-app');
    expect(resolved?.dir).toBe(bundleDir);
  });

  it('版本对不上就拒绝使用 —— 宁可去下载也不把旧后端打进新包', () => {
    const appRoot = makeTempDir('aionui-offline-stale-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(bundleDir, { version: 'v0.1.62' });

    const resolved = resolveOfflineAioncoreBundle({
      projectRoot: makeTempDir('aionui-offline-project-'),
      platform: 'darwin',
      arch: 'x64',
      version: 'v0.1.63',
      appRoots: [appRoot],
    });

    expect(resolved).toBeNull();
  });

  it('整包不完整(缺 managed-resources 契约)就拒绝使用', () => {
    const appRoot = makeTempDir('aionui-offline-partial-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    writeFile(join(bundleDir, BINARY_NAME), 'fake-binary');
    writeFile(
      join(bundleDir, 'manifest.json'),
      JSON.stringify({ platform: 'darwin', arch: 'x64', version: 'v0.1.63' })
    );

    const resolved = resolveOfflineAioncoreBundle({
      projectRoot: makeTempDir('aionui-offline-project-'),
      platform: 'darwin',
      arch: 'x64',
      version: 'v0.1.63',
      appRoots: [appRoot],
    });

    expect(resolved).toBeNull();
  });

  it('版本无从比对(latest)时不使用离线整包', () => {
    const appRoot = makeTempDir('aionui-offline-latest-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(bundleDir);

    const resolved = resolveOfflineAioncoreBundle({
      projectRoot: makeTempDir('aionui-offline-project-'),
      platform: 'darwin',
      arch: 'x64',
      version: 'latest',
      appRoots: [appRoot],
    });

    expect(resolved).toBeNull();
  });
});

describe('prepare-aioncore 走离线整包', () => {
  it('仓库缓存里已有完整整包时直接复用，不联网', () => {
    const projectRoot = makeTempDir('aionui-offline-cache-');
    const cacheDir = join(projectRoot, 'resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(cacheDir);

    const result = prepareAioncore({
      projectRoot,
      platform: 'darwin',
      arch: 'x64',
      version: 'v0.1.63',
      appRoots: [],
    });

    expect(result.sourceType).toBe('offline-bundle');
    expect(result.dir).toBe(cacheDir);
  });

  it('已装应用里的完整整包会被整包拷进仓库缓存', () => {
    const projectRoot = makeTempDir('aionui-offline-install-');
    const appRoot = makeTempDir('aionui-offline-app-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(bundleDir);

    const result = prepareAioncore({
      projectRoot,
      platform: 'darwin',
      arch: 'x64',
      version: 'v0.1.63',
      appRoots: [appRoot],
    });

    const cachedDir = join(projectRoot, 'resources', 'bundled-aioncore', RUNTIME_KEY);
    expect(result.sourceType).toBe('offline-bundle');
    expect(result.dir).toBe(cachedDir);
    // 整包是"整包"拷过去的：二进制、Node 运行时、契约一个都不能少。
    expect(() => statSync(join(cachedDir, BINARY_NAME))).not.toThrow();
    expect(() => statSync(join(cachedDir, 'managed-resources', 'manifest.json'))).not.toThrow();
  });

  it('版本对不上时不用离线整包 —— 继续走下载分支', () => {
    const projectRoot = makeTempDir('aionui-offline-mismatch-');
    const appRoot = makeTempDir('aionui-offline-app-');
    const bundleDir = join(appRoot, 'BadouWorklocal.app', 'Contents', 'Resources', 'bundled-aioncore', RUNTIME_KEY);
    createCompleteBundle(bundleDir, { version: 'v0.1.62' });

    // 用假工具链让下载立刻失败(真去连 GitHub 要等 75 秒超时),断言的是
    // "没有拿版本对不上的离线整包糊弄过去"。
    const fakeBin = makeTempDir('aionui-offline-bin-');
    writeFile(join(fakeBin, 'curl'), '#!/usr/bin/env bash\nexit 1\n');
    writeFile(join(fakeBin, 'wget'), '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(join(fakeBin, 'curl'), 0o755);
    chmodSync(join(fakeBin, 'wget'), 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}:${previousPath || ''}`;

    try {
      expect(() =>
        prepareAioncore({
          projectRoot,
          platform: 'darwin',
          arch: 'x64',
          version: 'v0.1.63',
          appRoots: [appRoot],
        })
      ).toThrow(/aioncore binary not found/);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  });
});
