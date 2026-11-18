/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 「微应用怎么被加载」的环境指纹。
 *
 * 背景:渲染进程 bundle 里的微应用接线(开关、asset base、逐个应用的 entry 覆盖)
 * 来自两处 —— Vite 加载的 `packages/desktop/.env*` 文件,以及 `process.env` 里的
 * 同名变量(Vite 里 `process.env` 优先于 `.env` 文件)。两处都不在源码树里,
 * 所以增量构建的 hash 光看源码是看不出变化的:换掉 asset base 之后,缓存照样命中,
 * 渲染进程 bundle 里留的还是上一个 base。
 *
 * 指纹相同 ⟹ 有效环境相同 ⟹ bundle 可以复用;指纹不同 ⟹ 必须重建。
 *
 * The renderer bundle's micro-app wiring comes from the `.env*` files Vite loads plus
 * the `process.env` overrides (which win over the files). Neither lives in the source
 * tree, so a source-only hash would happily reuse a bundle built for a different asset
 * base. Same fingerprint means the effective environment is the same, so the cached
 * renderer bundle is still valid.
 */

/** 名字里带 MICRO_APP、或以 `_APP_ENTRY` 结尾的 `VITE_` 变量。 */
const MICRO_APP_ENV_KEY_PATTERN = /^VITE_(?:.*MICRO_APP.*|.*_APP_ENTRY)$/;

/**
 * 收集环境里覆盖 `.env` 文件的微应用相关变量,按名字排序保证稳定。
 *
 * Collect the micro-app related `VITE_*` overrides from the environment, sorted so the
 * fingerprint is stable regardless of the order the variables were exported in.
 */
function collectMicroAppEnvOverrides(env = process.env) {
  return Object.keys(env)
    .filter((key) => MICRO_APP_ENV_KEY_PATTERN.test(key))
    .toSorted()
    .map((key) => `${key}=${env[key]}`);
}

/**
 * 列出 Vite 会加载的 env 文件(Vite 的 envDir 是 `packages/desktop`)。
 *
 * List the env files Vite loads — the renderer's `envDir` is `packages/desktop`.
 */
function listEnvFiles(rootDir) {
  const envDir = path.join(rootDir, 'packages', 'desktop');
  let names;
  try {
    names = fs.readdirSync(envDir);
  } catch {
    return [];
  }
  return names.filter((name) => name.startsWith('.env')).toSorted();
}

/** 仓库根目录(本文件在 `packages/shared-scripts/src/`)。 */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * 算出「这次构建的渲染进程 bundle 会长什么样」的环境指纹。
 *
 * Compute the fingerprint of the environment inputs that shape the renderer bundle.
 */
function computeMicroAppEnvFingerprint({ rootDir = REPO_ROOT, env = process.env } = {}) {
  const parts = [];

  for (const name of listEnvFiles(rootDir)) {
    const filePath = path.join(rootDir, 'packages', 'desktop', name);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const digest = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
    parts.push(`file:${name}:${digest}`);
  }

  for (const entry of collectMicroAppEnvOverrides(env)) {
    parts.push(`env:${entry}`);
  }

  return parts.join('\n');
}

module.exports = {
  collectMicroAppEnvOverrides,
  computeMicroAppEnvFingerprint,
  listEnvFiles,
  MICRO_APP_ENV_KEY_PATTERN,
};
