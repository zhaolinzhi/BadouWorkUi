/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveAutoArchArgs } = require('../../../packages/shared-scripts/src/resolve-auto-arch-args.js') as {
  resolveAutoArchArgs: (platform: string | null, hostArch: string) => string[];
};

describe('resolveAutoArchArgs', () => {
  it('gives an x64 host a single arch on every platform', () => {
    // prepareAioncore 要执行目标架构的二进制,x64 机器跑不了 arm64 → 只能出 x64。
    // prepareAioncore execFileSync's the target binary, so an x64 host cannot produce arm64.
    expect(resolveAutoArchArgs('mac', 'x64')).toEqual(['x64']);
    expect(resolveAutoArchArgs('win', 'x64')).toEqual(['x64']);
    expect(resolveAutoArchArgs('linux', 'x64')).toEqual(['x64']);
  });

  it('lets an arm64 mac host build both arches', () => {
    // Rosetta 2 让 arm64 机器跑 x86_64 二进制,两个架构都能 prepare。
    // Rosetta 2 lets arm64 hosts run x86_64 binaries, so both arches can be prepared.
    expect(resolveAutoArchArgs('mac', 'arm64')).toEqual(['arm64', 'x64']);
  });

  it('lets an arm64 windows host build both arches', () => {
    // Windows on ARM 有系统级 x64 模拟。
    // Windows on ARM has system-level x64 emulation.
    expect(resolveAutoArchArgs('win', 'arm64')).toEqual(['arm64', 'x64']);
  });

  it('never asks for x64 on an arm64 linux host', () => {
    // Linux 能不能跑 x64 取决于镜像有没有配 binfmt_misc,不可预测 —— 不放行多架构。
    // Whether Linux can run x64 depends on binfmt_misc being configured in the image, which
    // is unpredictable — multi-arch is not allowed.
    expect(resolveAutoArchArgs('linux', 'arm64')).toEqual(['arm64']);
  });

  it('falls back to the host arch when no platform flag was given', () => {
    // `auto` 不带 --mac/--win/--linux 时 detectedPlatform 是 null,不能当成 linux 之外的特例,
    // 也不该凭空多出一个架构。
    // With no platform flag detectedPlatform is null; no extra arch should be invented.
    expect(resolveAutoArchArgs(null, 'x64')).toEqual(['x64']);
    expect(resolveAutoArchArgs(null, 'arm64')).toEqual(['arm64']);
  });

  it('returns an empty-ish list only for the host arch, never an empty list', () => {
    // 下游会把结果拼成 `--<arch>`,空列表会产出裸 `--`。
    // The result is joined into `--<arch>` downstream; an empty list would emit a bare `--`.
    for (const host of ['x64', 'arm64']) {
      for (const platform of ['mac', 'win', 'linux', null]) {
        expect(resolveAutoArchArgs(platform, host).length).toBeGreaterThan(0);
      }
    }
  });
});
