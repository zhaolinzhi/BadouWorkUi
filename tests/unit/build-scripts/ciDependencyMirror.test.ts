/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

const REPO_ROOT = resolve(__dirname, '../../..');
const WORKFLOWS_DIR = resolve(REPO_ROOT, '.github/workflows');

type Workflow = {
  jobs?: Record<
    string,
    {
      steps?: {
        name?: string;
        uses?: string;
        run?: string;
        env?: Record<string, string>;
      }[];
    }
  >;
};

function readWorkflow(name: string): Workflow {
  return load(readFileSync(resolve(WORKFLOWS_DIR, name), 'utf8')) as Workflow;
}

function allWorkflowFiles(): string[] {
  return [
    '_build-reusable.yml',
    'build-and-release.yml',
    'pack-web-cli.yml',
    'pr-checks.yml',
    'pr-checks-docs.yml',
    'pr-e2e-artifacts.yml',
  ];
}

/**
 * CI 的依赖下载源。
 *
 * 背景:GitHub Releases 的 CDN 在 CI runner 上会间歇性返回
 * 504 Gateway Time-out。Bun 的二进制(bun-v<version>-<os>-<arch>.zip)和
 * Electron 的二进制(electron-v<version>-<platform>-<arch>.zip)都托管在那里,
 * 所以一次 504 会让整个 job 在 `bun install` 之前就挂掉 —— 打包任务则是在
 * "packaging" 阶段挂掉("Response code 504 (Gateway Time-out) failedTask=build")。
 *
 * 修法有两层:
 *  1. Bun 固定版本(.bun-version)。setup-bun 只在版本是具体值时才启用它自带的
 *     缓存(isCacheEnabled() 拒绝 latest|canary|action),命中缓存就完全不联网。
 *  2. 下载源切到 npmmirror 镜像,文件名规则与官方一致。
 *
 * The CI runners intermittently get 504 Gateway Time-out from the GitHub
 * Releases CDN, which hosts both the Bun and the Electron binaries. One 504
 * therefore kills a job before `bun install` even runs.
 */
describe('CI 依赖下载源', () => {
  it('仓库根有 .bun-version,Bun 版本被固定', () => {
    const version = readFileSync(resolve(REPO_ROOT, '.bun-version'), 'utf8').trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('固定版本和本地开发环境一致,避免 bun.lock 跨版本漂移', () => {
    // bun.lock 的 lockfileVersion 在 Bun 大版本之间会变;CI 跑一个和本地不同的
    // Bun 版本会重新生成 lockfile,`--frozen-lockfile` 随即失败。
    // The lockfile format changes across Bun majors; a mismatch makes
    // `bun install --frozen-lockfile` fail.
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    const declared = pkg.packageManager?.match(/bun@(\d+\.\d+\.\d+)/)?.[1];
    const pinned = readFileSync(resolve(REPO_ROOT, '.bun-version'), 'utf8').trim();
    if (declared) {
      expect(pinned).toBe(declared);
    }
  });

  it('所有 workflow 都通过复合 action 装 Bun,不再直接依赖 oven-sh/setup-bun', () => {
    for (const file of allWorkflowFiles()) {
      const content = readFileSync(resolve(WORKFLOWS_DIR, file), 'utf8');
      expect(content, `${file} 仍在直接使用 oven-sh/setup-bun`).not.toContain('oven-sh/setup-bun');
    }
  });

  it('复合 action 读取固定版本,而不是 latest', () => {
    const action = readFileSync(resolve(REPO_ROOT, '.github/actions/setup-bun/action.yml'), 'utf8');
    expect(action).toContain('bun-version-file: .bun-version');
    // latest/canary 会让 setup-bun 关掉自带缓存,等于每次都联网下载。
    expect(action).not.toMatch(/bun-version:\s*latest/);
  });

  it('复合 action 在 GitHub Releases 失败时回退到镜像源', () => {
    const action = readFileSync(resolve(REPO_ROOT, '.github/actions/setup-bun/action.yml'), 'utf8');
    // 回退步骤必须以 oven-sh/setup-bun 的失败为条件。
    expect(action).toMatch(/if:\s*\$\{\{\s*steps\.setup-bun-primary\.outcome\s*==\s*'failure'\s*\}\}/);
    expect(action).toContain('registry.npmmirror.com');
  });

  it('打包步骤用镜像源下载 Electron', () => {
    const workflow = readWorkflow('_build-reusable.yml');
    const steps = workflow.jobs?.build?.steps ?? [];
    const buildSteps = steps.filter((step) => /Build with electron-builder/.test(step.name ?? ''));
    expect(buildSteps.length).toBeGreaterThanOrEqual(3);
    for (const step of buildSteps) {
      const mirror = step.env?.ELECTRON_MIRROR;
      expect(mirror, `步骤「${step.name}」缺少 ELECTRON_MIRROR`).toBeTruthy();
      expect(mirror, `步骤「${step.name}」的 ELECTRON_MIRROR 仍指向官方源`).not.toBe('');
      expect(mirror, `步骤「${step.name}」的 ELECTRON_MIRROR 未指向镜像源`).toContain('npmmirror.com');
    }
  });

  it('electron-builder.yml 配置了 Electron 镜像,本地打包也不再依赖 GitHub Releases', () => {
    const builder = load(readFileSync(resolve(REPO_ROOT, 'packages/desktop/electron-builder.yml'), 'utf8')) as {
      electronDownload?: { mirror?: string };
    };
    expect(builder.electronDownload?.mirror).toContain('npmmirror.com');
  });

  it('macOS 打包步骤在网络故障时重试', () => {
    // Linux 步骤本来就有 nick-fields/retry;macOS 步骤是裸跑 shell,一次 504 就报废。
    // The Linux step already retries; the macOS step was a bare shell script.
    const workflow = readWorkflow('_build-reusable.yml');
    const steps = workflow.jobs?.build?.steps ?? [];
    const macos = steps.find((step) => /Build with electron-builder \(macOS\)/.test(step.name ?? ''));
    expect(macos?.run).toBeTruthy();
    // 必须真的重试若干次,而不是把上限设成 1(那等于不重试)。
    // The attempt count must actually be > 1, not 1 (which is no retry at all).
    const attempts = macos?.run?.match(/BUILD_MAX_ATTEMPTS=(\d+)/)?.[1];
    expect(Number(attempts)).toBeGreaterThan(1);
  });

  it('macOS 重试不会把「公证失败但 DMG 已生成」误判为需要重试', () => {
    // 重试条件里只要发现 DMG 就该停 —— 否则一个已经能发布的包会被白白重试三次。
    // The retry must stop as soon as a DMG exists, otherwise a shippable
    // package is rebuilt three extra times.
    const workflow = readWorkflow('_build-reusable.yml');
    const steps = workflow.jobs?.build?.steps ?? [];
    const macos = steps.find((step) => /Build with electron-builder \(macOS\)/.test(step.name ?? ''));
    expect(macos?.run).toMatch(/ls out\/\*\.dmg/);
  });
});
