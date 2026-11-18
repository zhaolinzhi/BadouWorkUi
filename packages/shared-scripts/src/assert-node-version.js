/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs');
const path = require('path');

/**
 * node 版本闸门。
 *
 * 为什么需要它:仓库的 engines 要求 `node >=22 <25`,但构建脚本是用 PATH 上的
 * `node` 跑的(`bun run` 不会把 node 换成 bun —— 实测 `bun run node -v` 拿到的是
 * 真实 node)。低版本 node 不会给出直白的报错,而是以很难排查的形式失败:
 *
 * - `scripts/build-micro-apps.mjs` 用了 `fs.cpSync`(node >= 16.7 才有)→ node 14 上
 *   直接 `fs.cpSync is not a function`;
 * - 子应用的 vite 构建(unocss / vite-plugin-qiankun 的 ESM 用了 ES2021 的 `||=`)
 *   在 node 14 上抛 `SyntaxError: Unexpected token '||='`,而 `bun run build` 依然
 *   返回退出码 0 —— 失败被吞掉,要等到后面「产物里没有 dist/index.html」才暴露,
 *   报错信息跟真实原因不沾边。
 *
 * 所以在构建入口就把版本卡掉,报错直指「node 太旧」。
 *
 * Why this exists: the build scripts run under the `node` found on PATH (`bun run`
 * does not shim `node` to bun). An old node fails in confusing ways — `fs.cpSync`
 * is missing (node < 16.7), and the micro apps' vite build dies on `||=` while
 * still exiting 0, so the real cause only surfaces later as a missing
 * `dist/index.html`. Gating at the entry point turns that into one clear message.
 */

const ROOT_PACKAGE_JSON = path.resolve(__dirname, '..', '..', '..', 'package.json');

/**
 * 读根 package.json 的 engines.node,解析成 { min, max }。
 *
 * 范围形如 `">=22 <25"`。解析不了就退回 { min: 22, max: Infinity } —— 宁可按
 * 仓库默认值卡,也不要因为解析失败而放行任意版本。
 *
 * Read the root package.json's `engines.node` and parse it into `{ min, max }`.
 * Falls back to `{ min: 22, max: Infinity }` when the range cannot be parsed.
 *
 * @param {string} [packageJsonPath] 根 package.json 的路径(测试用)
 * @returns {{ min: number, max: number, raw: string }}
 */
function readNodeEngineRange(packageJsonPath = ROOT_PACKAGE_JSON) {
  const fallback = { min: 22, max: Infinity, raw: '' };
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    const range = JSON.parse(raw)?.engines?.node;
    if (typeof range !== 'string') return fallback;
    const min = />=\s*(\d+)/.exec(range);
    const max = /<\s*(\d+)/.exec(range);
    return {
      min: min ? Number(min[1]) : fallback.min,
      max: max ? Number(max[1]) : fallback.max,
      raw: range,
    };
  } catch {
    return fallback;
  }
}

/**
 * 取 node 主版本号。`v22.23.1` / `22.23.1` 都认。
 *
 * @param {string} version 版本串
 * @returns {number} 主版本号;解析不出来返回 NaN
 */
function parseNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(String(version ?? '').trim());
  return match ? Number(match[1]) : NaN;
}

/**
 * 断言当前 node 版本在 engines 允许的范围内,不满足就抛错。
 *
 * Assert the running node version is within the range declared by `engines.node`.
 *
 * @param {string} [version] 要检查的版本串,默认取当前进程
 * @returns {number} 通过检查的主版本号
 * @throws {Error} 版本过低 / 过高 / 无法解析
 */
function assertNodeVersion(version = process.versions.node) {
  const major = parseNodeMajor(version);
  if (!Number.isFinite(major)) {
    throw new Error(`无法解析 node 版本: "${version}"`);
  }

  const { min, max, raw } = readNodeEngineRange();
  if (major < min) {
    throw new Error(
      `需要 node >= ${min}(仓库 engines 要求 "${raw}"),当前是 ${version}。` +
        `旧版 node 会在构建期以难懂的方式失败 —— 比如子应用的 vite 构建报 ` +
        `"SyntaxError: Unexpected token '||='" 却仍返回退出码 0。先切到合规版本再重试` +
        `(nvm use ${min})。`
    );
  }
  // engines 的上界是排他的(`<25` 不含 25),所以这里用 >=。
  // The upper bound in engines is exclusive (`<25` excludes 25), hence >=.
  if (major >= max) {
    throw new Error(
      `需要 node < ${max}(仓库 engines 要求 "${raw}"),当前是 ${version}。` + `请切到合规版本(nvm use ${min})后重试。`
    );
  }
  return major;
}

module.exports = { assertNodeVersion, parseNodeMajor, readNodeEngineRange };
