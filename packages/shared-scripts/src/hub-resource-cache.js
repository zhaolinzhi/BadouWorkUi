/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @module hub-resource-cache
 *
 * `resources/hub/` 本地缓存的探测 —— 给连不上 GitHub / jsDelivr 的构建机兜底。
 *
 * 背景:hub 资源(index.json + 各扩展 zip)是**离线兜底**用的,不是构建的硬依赖。
 * 但 `prepareHubResources.js` 以前先 `rm -rf resources/hub` 再下载,一旦网络抖一下
 * 就会把上一份好缓存删掉,然后下载失败 → 脚本 exit 1 → 整个打包中断。
 * 「一次网络抖动就毁掉可用的本地兜底」是纯粹的倒退。
 *
 * 所以先只读探测缓存是否可用,再决定是「下载新的」还是「沿用旧的」。
 * 下载成功前绝不动旧缓存。
 *
 * Background: hub resources (index.json + extension zips) are an **offline
 * fallback**, not a hard build dependency. `prepareHubResources.js` used to
 * `rm -rf resources/hub` *before* downloading, so a single network blip
 * destroyed a good cache and then failed the whole packaging run. A transient
 * network failure must never destroy working local state.
 *
 * 关于 tag 不一致:tag 不同只是「另一个上游快照」,**不影响缓存可用性**。
 * 后端(aioncore 的 `hub::index_manager`)校验的是 index.json 的 `schemaVersion`,
 * 不是 git tag —— schema 兼容就能用。但调用方要负责把差异 warn 出来,
 * 免得日后排查「包里为什么是旧扩展」。
 *
 * On a tag mismatch the cache stays usable: the backend validates
 * `index.json`'s `schemaVersion`, not the git tag. The caller is responsible
 * for warning about the difference.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = 'manifest.json';
const INDEX_FILE = 'index.json';

/**
 * 路径是不是普通文件。
 *
 * @param {string} target 路径。
 * @returns {boolean} 是普通文件返回 true。
 */
function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

/**
 * 读 JSON,解析失败当没有。
 *
 * @param {string} filePath 文件路径。
 * @returns {object|null} 解析结果,读不到或不是合法 JSON 返回 null。
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 缓存目录里「扩展 zip」的清单。
 *
 * 优先取 manifest.json 记录的 `extensions[].file`(也就是 index.json 里
 * `dist.tarball` 的 basename);manifest 缺失时退化成扫目录里的 `*.zip`。
 *
 * **只列真实存在的文件** —— manifest 是上一次成功下载时写的,和磁盘状态
 * 可能已经不一致(比如下载中途被中断)。信 manifest 而不查文件,会得出
 * 「缓存里有扩展」的假结论。
 *
 * Only files that actually exist are listed: the manifest was written by a
 * previous successful download and may be out of sync with the disk (an
 * interrupted download, for instance). Trusting it blindly would report a
 * cache as usable when the zips are gone.
 *
 * @param {string} hubDir hub 缓存目录。
 * @returns {string[]} zip 文件名列表。
 */
function listCachedZipNames(hubDir) {
  const manifest = readJson(path.join(hubDir, MANIFEST_FILE));
  const fromManifest =
    manifest && Array.isArray(manifest.extensions)
      ? manifest.extensions.map((entry) => entry && entry.file).filter((name) => typeof name === 'string')
      : [];
  if (fromManifest.length > 0) {
    return fromManifest.filter((name) => isFile(path.join(hubDir, path.basename(name))));
  }

  try {
    return fs
      .readdirSync(hubDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.zip'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * manifest.json 是否存在且能解析。
 *
 * 「文件在」不等于「文件可用」—— 下载写了一半会留下一个截断的 JSON,
 * 它存在但解析失败。这种 manifest 不能用来判断 tag,也不能算作有效缓存。
 *
 * A manifest that exists but does not parse (a truncated file from an
 * interrupted download) cannot be used to determine the tag and does not
 * count as a valid cache.
 *
 * @param {string} hubDir hub 缓存目录。
 * @returns {boolean} manifest 可用返回 true。
 */
function hasValidManifest(hubDir) {
  return readJson(path.join(hubDir, MANIFEST_FILE)) !== null;
}

/**
 * 缓存目录是否「可用」。
 *
 * 三个要件缺一不可:`index.json`(运行时读它才知道有哪些扩展)、
 * 至少一个扩展 zip(不然缓存了个寂寞)、`manifest.json`(判断 tag 用)。
 *
 * @param {string} hubDir hub 缓存目录。
 * @returns {boolean} 可用返回 true。
 */
function isHubCacheUsable(hubDir) {
  if (!isFile(path.join(hubDir, INDEX_FILE))) return false;
  if (!hasValidManifest(hubDir)) return false;
  return listCachedZipNames(hubDir).length > 0;
}

/**
 * 缓存 manifest 记录的 tag。
 *
 * @param {string} hubDir hub 缓存目录。
 * @returns {string|null} tag,读不到返回 null。
 */
function readCachedHubTag(hubDir) {
  const manifest = readJson(path.join(hubDir, MANIFEST_FILE));
  if (!manifest || typeof manifest.tag !== 'string' || !manifest.tag) return null;
  return manifest.tag;
}

/**
 * 找某个扩展的缓存 zip。
 *
 * 优先按 manifest 里记录的 `file` 精确匹配;匹配不到再按 `<extensionName>.zip`
 * 兜底(有些上游的 tarball 名和扩展名不一致)。
 *
 * @param {string} hubDir hub 缓存目录。
 * @param {string} extensionName 扩展名,例如 `aionext-qwen`。
 * @returns {string|null} zip 绝对路径,没有返回 null。
 */
function findCachedExtensionZip(hubDir, extensionName) {
  const manifest = readJson(path.join(hubDir, MANIFEST_FILE));
  const entries = manifest && Array.isArray(manifest.extensions) ? manifest.extensions : [];
  for (const entry of entries) {
    if (!entry || entry.name !== extensionName || typeof entry.file !== 'string') continue;
    const candidate = path.join(hubDir, path.basename(entry.file));
    if (isFile(candidate)) return candidate;
  }
  const fallback = path.join(hubDir, `${extensionName}.zip`);
  return isFile(fallback) ? fallback : null;
}

/**
 * 探测缓存状态 —— 脚本唯一的决策入口。
 *
 * 「可用」的含义:目录里有 `index.json`、至少一个扩展 zip、`manifest.json`。
 * tag 不一致**不影响**可用性(缓存仍然是一份能用的离线兜底),但会被标记出来
 * 供上层记录 —— 上层据此决定要不要在日志里强调版本差异。
 *
 * 本函数是只读的:不写、不删、不建目录。
 *
 * @param {string} hubDir hub 缓存目录。
 * @param {string} tag 本次请求的 tag。
 * @returns {{ usable: boolean, reason: string, cachedTag: string | null, cachedFiles: string[], tagMatches: boolean }} 探测结果。
 */
function inspectHubCache(hubDir, tag) {
  const cachedTag = readCachedHubTag(hubDir);
  const cachedFiles = listCachedZipNames(hubDir);
  const hasIndex = isFile(path.join(hubDir, INDEX_FILE));
  const hasManifest = hasValidManifest(hubDir);

  if (!hasIndex && !hasManifest && cachedFiles.length === 0) {
    return { usable: false, reason: 'missing', cachedTag: null, cachedFiles: [], tagMatches: false };
  }
  if (!hasIndex) {
    return { usable: false, reason: 'missing_index', cachedTag, cachedFiles, tagMatches: false };
  }
  if (!hasManifest) {
    return { usable: false, reason: 'missing_manifest', cachedTag, cachedFiles, tagMatches: false };
  }
  if (cachedFiles.length === 0) {
    return { usable: false, reason: 'missing_extensions', cachedTag, cachedFiles, tagMatches: false };
  }

  return {
    usable: true,
    reason: 'ok',
    cachedTag,
    cachedFiles,
    tagMatches: Boolean(cachedTag) && cachedTag === tag,
  };
}

module.exports = {
  findCachedExtensionZip,
  hasValidManifest,
  inspectHubCache,
  isHubCacheUsable,
  listCachedZipNames,
  readCachedHubTag,
};
