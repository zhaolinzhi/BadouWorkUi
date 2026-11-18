/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';

const REPO_ROOT = resolve(__dirname, '../../..');

function readProjectFile(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function readBuilderConfig(): Record<string, unknown> {
  return loadYaml(readProjectFile('packages/desktop/electron-builder.yml')) as Record<string, unknown>;
}

/** 收集配置里所有字符串值 —— 用来找出没被展开的 `${env.…}` 模板 */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

/**
 * Electron 下载缓存的配置。
 *
 * 背景:electron-builder 的 YAML **不做 shell 变量插值**。之前这里写着
 * `electronDownload: cache: ${env.ELECTRON_CACHE}`,那串字面量被原样透传给
 * `@electron/get` 当作 zip 的 cacheRoot,再经 `path.resolve` 按 CWD 解析 ——
 * 于是仓库根每次打包都会多出一个名为 `${env.ELECTRON_CACHE}` 的目录,
 * 把 Electron 的 zip 又下载一份进去(219M),而真正的缓存目录里本来就有一份。
 *
 * 真正能控制下载缓存的是 `ELECTRON_BUILDER_CACHE` 环境变量(必须是绝对路径),
 * electron-builder 会用它拼出 `<cache>/downloads`;不设则退回系统默认缓存目录。
 */
describe('Electron 下载缓存配置', () => {
  it('electron-builder.yml 里没有未展开的 ${env.…} 模板', () => {
    const offenders = collectStrings(readBuilderConfig()).filter((value) => value.includes('${env.'));
    expect(offenders).toEqual([]);
  });

  it('electronDownload 不覆盖 cache —— 否则会在仓库根生成字面量目录', () => {
    const electronDownload = readBuilderConfig().electronDownload as { cache?: unknown } | undefined;
    expect(electronDownload?.cache).toBeUndefined();
  });

  it('.gitignore 不再为那个字面量目录打补丁', () => {
    expect(readProjectFile('.gitignore')).not.toContain('${env.ELECTRON_CACHE}');
  });

  it('CI 用 ELECTRON_BUILDER_CACHE 控制下载缓存', () => {
    for (const workflow of ['.github/workflows/pr-checks.yml', '.github/workflows/_build-reusable.yml']) {
      const content = readProjectFile(workflow);
      expect(content).toContain('ELECTRON_BUILDER_CACHE: ${{ runner.temp }}/');
      // ELECTRON_CACHE 没有任何消费者(整个 node_modules 里零命中),留着只会误导
      expect(content).not.toMatch(/^\s*ELECTRON_CACHE:/m);
    }
  });

  it('Windows worktree 构建脚本也指向 ELECTRON_BUILDER_CACHE', () => {
    const script = readProjectFile('scripts/build-fast-debug-worktrees.ps1');
    expect(script).toContain('$env:ELECTRON_BUILDER_CACHE');
    expect(script).not.toMatch(/\$env:ELECTRON_CACHE\b/);
  });
});
