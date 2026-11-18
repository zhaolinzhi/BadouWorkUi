/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

const fs = require('fs');
const path = require('path');

/**
 * 找出 `resources/bundled-aioncore/` 下不属于本次构建目标的架构目录。
 *
 * 为什么需要清理:electron-builder.yml 的 `extraResources` 是整目录复制
 * (`from: resources/bundled-aioncore` → `to: bundled-aioncore`),不做按架构筛选。
 * 于是上一次构建(或一次失败的构建)留下的残骸会被一起打进**每一个**安装包:
 *
 * - 一个失败的 prepare 留下的目录只有 aioncore、没有 manifest.json、没有
 *   managed-resources —— 这是最常见的情况,因为 prepareAioncore 一旦失败就停在
 *   拉取 managed-resources 之前。
 * - 白占体积(一个 Darwin arm64 的 aioncore 约 96MB)。
 * - 更糟的是「目录存在但不完整」:如果运行时按目录存在性判断架构,会选中残缺的那份。
 *
 * 判断纯粹是「目录名不在本次目标集合里」,不看内容 —— 因为一个本机跑不动的架构
 * 根本没法通过执行 prepare 来验证完整性。
 *
 * Finds architecture directories under `resources/bundled-aioncore/` that the current build
 * does not target.
 *
 * Pruning is required because electron-builder.yml copies the whole directory through
 * `extraResources` (`from: resources/bundled-aioncore` → `to: bundled-aioncore`) with no
 * per-arch filtering, so remnants from an earlier or failed build ride along inside every
 * installer:
 *
 * - A failed prepare leaves a directory holding only `aioncore`, with no `manifest.json` and
 *   no `managed-resources`, because prepareAioncore stops before fetching managed resources.
 * - It wastes space (a Darwin arm64 `aioncore` is roughly 96 MB).
 * - Worse, the directory *exists but is incomplete*: if runtime code decides the architecture
 *   by checking which directory exists, it can select the broken one.
 *
 * The test is purely "is the directory name absent from this build's target set", never
 * content inspection — an architecture the host cannot execute can never be validated by
 * running prepare.
 *
 * @param {string[]} existingDirNames Directory names currently present in the bundled dir.
 * @param {string[]} requiredRuntimeKeys Runtime keys this build packages, e.g. `['darwin-x64']`.
 * @returns {string[]} Names to delete. Empty when everything present is a build target.
 */
function findStaleAioncoreBundleNames(existingDirNames, requiredRuntimeKeys) {
  const required = new Set(requiredRuntimeKeys);
  return existingDirNames.filter((name) => !required.has(name));
}

/**
 * 删除 `resources/bundled-aioncore/` 下不属于本次构建目标的架构目录。
 *
 * 只删目录,不动里面的文件;目录不存在时安静返回,好让首次构建(还没 prepare 过)
 * 不被打断。
 *
 * Removes architecture directories under `resources/bundled-aioncore/` that this build does not
 * target.
 *
 * Only directories are removed, never loose files. A missing directory returns quietly so a
 * first build — which has not prepared anything yet — is not aborted.
 *
 * @param {string} bundledDir Absolute path to `resources/bundled-aioncore`.
 * @param {string[]} requiredRuntimeKeys Runtime keys this build packages, e.g. `['darwin-x64']`.
 * @returns {{ removed: string[], kept: string[] }} Directory names deleted and preserved.
 */
function pruneStaleAioncoreBundles(bundledDir, requiredRuntimeKeys) {
  let entries;
  try {
    entries = fs.readdirSync(bundledDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return { removed: [], kept: [] };
    throw error;
  }

  const dirNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const staleNames = findStaleAioncoreBundleNames(dirNames, requiredRuntimeKeys);

  for (const name of staleNames) {
    fs.rmSync(path.join(bundledDir, name), { recursive: true, force: true });
  }

  return {
    removed: staleNames,
    kept: dirNames.filter((name) => !staleNames.includes(name)),
  };
}

module.exports = { findStaleAioncoreBundleNames, pruneStaleAioncoreBundles };
