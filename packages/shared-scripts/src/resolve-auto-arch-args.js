/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

/**
 * `auto` 模式下,按「本机能执行哪些目标架构」给出架构参数列表。
 *
 * 为什么这是硬约束:打包流程的 prepareAioncore 会 `execFileSync` **目标架构**的
 * aioncore 二进制,让它去拉 managed-resources(里面是那个架构专属的 Node 运行时,
 * 如 `node-v24.11.0-darwin-x64`)。本机跑不动目标二进制,这一步就 EBADARCH(-86) 直接失败。
 * 方向是单向的:
 *
 * - Intel Mac 跑不了 arm64 二进制 → 只能出 x64
 * - arm64 Mac 能靠 Rosetta 2 跑 x86_64 二进制 → arm64 + x64 都能出(CI 就是这么分的:
 *   macos-arm64 和 macos-x64 两个 job 都跑在 macos-14 上)
 * - 同理适用于 Windows on ARM(x64 模拟);x64 Windows 只能出 x64
 * - Linux 不放行多架构:能否靠 binfmt_misc 跑 x64 取决于每个镜像的配置,不可靠
 *
 * electron-builder.yml 里 mac/win 都没写 `arch:`,所以 config 优先级低于本机判断。
 *
 * Returns the architecture list for `auto` mode based on what the build host can execute.
 *
 * This is a hard constraint, not a preference: prepareAioncore `execFileSync`s the *target*
 * aioncore binary to fetch managed-resources (which contains an arch-specific Node runtime such
 * as `node-v24.11.0-darwin-x64`). If the host cannot execute the target binary the step fails
 * with EBADARCH (-86). The relationship is one-directional:
 *
 * - An Intel Mac cannot run arm64 binaries → x64 only
 * - An arm64 Mac can run x86_64 binaries through Rosetta 2 → both arm64 and x64
 * - Same for Windows on ARM (x64 emulation); an x64 Windows host can only produce x64
 * - Linux is excluded: whether x64 runs through binfmt_misc depends on per-image configuration
 *
 * Neither `mac:` nor `win:` sets `arch:` in electron-builder.yml, so this host check decides.
 */

/**
 * @param {'mac' | 'win' | 'linux' | null} detectedPlatform 由命令行上的 `--mac` / `--win` /
 *   `--linux` 推断出来的目标平台;没有平台参数时为 null。
 * @param {string} hostArch `process.arch`,例如 'x64' / 'arm64'。
 * @returns {string[]} 传给 electron-builder 的架构参数,按"主架构优先"排序。
 */
function resolveAutoArchArgs(detectedPlatform, hostArch) {
  // 只有 mac / Windows on ARM 才有可依赖的 x64 模拟层。
  const canAlsoBuildX64 = hostArch === 'arm64' && (detectedPlatform === 'mac' || detectedPlatform === 'win');
  return canAlsoBuildX64 ? ['arm64', 'x64'] : [hostArch];
}

module.exports = { resolveAutoArchArgs };
