/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { collectMicroAppEnvOverrides, computeMicroAppEnvFingerprint } =
  require('../../../packages/shared-scripts/src/micro-app-env.js') as {
    collectMicroAppEnvOverrides: (env?: NodeJS.ProcessEnv) => string[];
    computeMicroAppEnvFingerprint: (options?: { rootDir?: string; env?: NodeJS.ProcessEnv }) => string;
  };

const REPO_ROOT = resolve(__dirname, '../../..');

/** 造一个只含 `packages/desktop/.env*` 的假仓库根目录。 */
function makeRoot(envFiles: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'aionui-micro-app-env-'));
  mkdirSync(join(root, 'packages', 'desktop'), { recursive: true });
  for (const [name, content] of Object.entries(envFiles)) {
    writeFileSync(join(root, 'packages', 'desktop', name), content);
  }
  return root;
}

/**
 * 微应用环境指纹。
 *
 * 渲染进程 bundle 里的微应用接线来自 `packages/desktop/.env*` 和 `process.env` 两处,
 * 两处都不在源码树里 —— 增量构建的 hash 若只看源码,换个 asset base 也会复用旧
 * bundle,装出来的包入口指向错的地方,而且本地完全看不出来。
 */
describe('微应用环境指纹', () => {
  it('env 文件内容变了,指纹跟着变', () => {
    const before = makeRoot({ '.env.production': 'VITE_MICRO_APP_ENABLED=true\n' });
    const after = makeRoot({ '.env.production': 'VITE_MICRO_APP_ENABLED=false\n' });

    expect(computeMicroAppEnvFingerprint({ rootDir: before })).not.toBe(
      computeMicroAppEnvFingerprint({ rootDir: after })
    );

    rmSync(before, { recursive: true, force: true });
    rmSync(after, { recursive: true, force: true });
  });

  it('内置形态与普通构建的指纹不同', () => {
    // 普通构建:环境里没有覆盖,asset base 来自 .env.production 的空占位。
    // 内置形态:build-with-builder.js 注入 app://microapps。
    const root = makeRoot({ '.env.production': 'VITE_MICRO_APP_ENABLED=true\nVITE_MICRO_APP_ASSET_BASE=\n' });

    const plain = computeMicroAppEnvFingerprint({ rootDir: root, env: {} });
    const bundled = computeMicroAppEnvFingerprint({
      rootDir: root,
      env: { VITE_MICRO_APP_ENABLED: 'true', VITE_MICRO_APP_ASSET_BASE: 'app://microapps' },
    });

    expect(bundled).not.toBe(plain);
    expect(bundled).toContain('app://microapps');

    rmSync(root, { recursive: true, force: true });
  });

  it('相同的输入算出相同的指纹', () => {
    const root = makeRoot({ '.env.production': 'VITE_MICRO_APP_ENABLED=true\n' });
    const env = { VITE_MICRO_APP_ASSET_BASE: 'app://microapps' };

    expect(computeMicroAppEnvFingerprint({ rootDir: root, env })).toBe(
      computeMicroAppEnvFingerprint({ rootDir: root, env })
    );

    rmSync(root, { recursive: true, force: true });
  });

  it('env 目录不存在时不抛异常', () => {
    // 指纹算不出来时不该把整个构建带崩 —— 顶多退化成「每次都重建」。
    expect(() =>
      computeMicroAppEnvFingerprint({ rootDir: join(tmpdir(), 'aionui-does-not-exist'), env: {} })
    ).not.toThrow();
  });

  it('只收集微应用相关的 VITE_ 覆盖', () => {
    const collected = collectMicroAppEnvOverrides({
      VITE_MICRO_APP_ENABLED: 'true',
      VITE_MICRO_APP_ASSET_BASE: 'app://microapps',
      VITE_NOTES_APP_ENTRY: 'https://cdn.example.com/notes/index.html',
      VITE_SOMETHING_ELSE: 'ignored',
      PATH: '/usr/bin',
    });

    expect(collected).toContain('VITE_MICRO_APP_ENABLED=true');
    expect(collected).toContain('VITE_MICRO_APP_ASSET_BASE=app://microapps');
    expect(collected).toContain('VITE_NOTES_APP_ENTRY=https://cdn.example.com/notes/index.html');
    expect(collected.some((entry) => entry.startsWith('VITE_SOMETHING_ELSE'))).toBe(false);
    expect(collected.some((entry) => entry.startsWith('PATH'))).toBe(false);
  });

  it('仓库里的 .env 文件确实被算进指纹', () => {
    // 仓库自己的 .env.production / .env.development 必须参与,否则改了它们
    // 增量构建会复用旧 bundle。
    const fingerprint = computeMicroAppEnvFingerprint({ rootDir: REPO_ROOT, env: {} });
    expect(fingerprint).toContain('file:.env.production:');
    expect(fingerprint).toContain('file:.env.development:');
  });
});
