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
      with?: { matrix?: string };
      strategy?: { matrix?: { include?: { platform?: string; arch?: string; os?: string }[] } };
      steps?: { name?: string; run?: string; env?: Record<string, string> }[];
    }
  >;
};

function readWorkflow(name: string): Workflow {
  return load(readFileSync(resolve(WORKFLOWS_DIR, name), 'utf8')) as Workflow;
}

/**
 * 找出所有真正跑构建命令的步骤。
 *
 * 按名字匹配而不是按 `run` —— Linux 那个步骤用的是 `nick-fields/retry` action
 * (命令在 `command:` 里,没有 `run`),按 `run` 过滤会把它漏掉。
 */
function buildSteps(
  workflow: Workflow,
  job: string,
  namePattern: RegExp
): { name?: string; env?: Record<string, string> }[] {
  const steps = workflow.jobs?.[job]?.steps ?? [];
  return steps.filter((step) => namePattern.test(step.name ?? ''));
}

/**
 * CI 必须把微应用打进安装包。
 *
 * `MICRO_APP_BUNDLE=1` 是唯一开关:它让 build-with-builder.js 注入
 * `VITE_MICRO_APP_ENABLED=true` + `VITE_MICRO_APP_ASSET_BASE=app://microapps`,
 * 并把子应用产物拷进 `out/renderer/microapps/`。
 *
 * 不设它会怎样:`.env.production` 里 `VITE_MICRO_APP_ENABLED=true` 照旧生效,
 * 但 `VITE_MICRO_APP_ASSET_BASE` 是空的 —— entry 解析会回落到
 * `//localhost:7991/7992/7993`,装好的包里那三个端口没人监听,子应用必然加载失败。
 * 也就是说:CI 不设这个变量,出来的包是「开关开着但指向 localhost」的坏包。
 *
 * The CI pipeline must bundle the micro apps. Without `MICRO_APP_BUNDLE=1` the
 * packaged app keeps `VITE_MICRO_APP_ENABLED=true` from `.env.production` but has an
 * empty asset base, so entries fall back to the localhost dev ports — a package whose
 * micro apps can never load.
 */
describe('CI 打包流水线内置微应用', () => {
  it('发布流水线的三个平台构建步骤都设了 MICRO_APP_BUNDLE', () => {
    const workflow = readWorkflow('_build-reusable.yml');
    const steps = buildSteps(workflow, 'build', /Build with electron-builder/);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) {
      expect(step.env?.MICRO_APP_BUNDLE, `步骤「${step.name}」缺少 MICRO_APP_BUNDLE`).toBe('1');
    }
  });

  it('PR 的 build-test 同样走内置微应用这条路径', () => {
    const workflow = readWorkflow('pr-checks.yml');
    const steps = buildSteps(workflow, 'build-test', /Build test/);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    for (const step of steps) {
      expect(step.env?.MICRO_APP_BUNDLE, `步骤「${step.name}」缺少 MICRO_APP_BUNDLE`).toBe('1');
    }
  });

  it('发布矩阵仍然覆盖六个平台/架构组合', () => {
    // 矩阵是以 JSON 字符串传给可复用 workflow 的(`with.matrix`),不是 YAML 映射。
    // The matrix is passed to the reusable workflow as a JSON string, not a YAML mapping.
    const workflow = readWorkflow('build-and-release.yml');
    const raw = workflow.jobs?.['build-pipeline']?.with?.matrix;
    expect(raw).toBeTruthy();
    const include = (JSON.parse(raw as string) as { include: { platform: string; arch: string }[] }).include;
    expect(include.map((entry) => `${entry.platform}/${entry.arch}`).sort()).toEqual([
      'linux-arm64/arm64',
      'linux-x64/x64',
      'macos-arm64/arm64',
      'macos-x64/x64',
      'windows-arm64/arm64',
      'windows-x64/x64',
    ]);
  });
});
