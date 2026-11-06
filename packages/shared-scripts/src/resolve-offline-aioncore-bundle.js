/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

/**
 * 离线找 aioncore 整包 —— 给连不上 GitHub 的构建机兜底。
 *
 * 背景:构建流程要从 GitHub Release 拉 aioncore 后端二进制。构建机连不上
 * GitHub 时,这一步会先卡到超时(`curl` 默认等 75 秒)才失败,整包构建直接中断。
 *
 * 但本机一般**已经装过**这个应用 —— 安装包里带着同一份 aioncore 整包:
 * 二进制 + `managed-resources/`(含 Node 运行时)+ manifest。仓库里上一次构建
 * 留下的 `resources/bundled-aioncore/<platform>-<arch>/` 也是同一份东西。
 * 两者都是候选,拿来直接用,打包就能完全离线地跑完。
 *
 * **只在版本对得上时才采用**。版本对不上就只能老老实实联网下载 —— 把旧版
 * 后端打进新包,比构建失败更糟。
 *
 * @module resolve-offline-aioncore-bundle
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * 已装应用的安装根目录(按平台)。
 *
 * macOS 是 `/Applications`,Windows 是 `%LOCALAPPDATA%\Programs` 与
 * `Program Files`,Linux 是 `/opt`、`/usr/lib`。
 *
 * @param {string} platform Node 平台名,如 `'darwin'`。
 * @returns {string[]} 安装根目录绝对路径。
 */
function listAppInstallRoots(platform) {
  switch (platform) {
    case 'darwin':
      return ['/Applications', path.join(os.homedir(), 'Applications')];
    case 'win32': {
      const roots = [];
      if (process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'Programs'));
      if (process.env.ProgramFiles) roots.push(process.env.ProgramFiles);
      if (process.env['ProgramFiles(x86)']) roots.push(process.env['ProgramFiles(x86)']);
      return roots;
    }
    default:
      return ['/opt', '/usr/lib', '/usr/local/lib'];
  }
}

/**
 * 判断路径是不是目录(跟随符号链接)。
 *
 * `/Applications` 下经常是软链,`readdir` 的 `isDirectory()` 对软链返回 false,
 * 直接用会把真身漏掉。
 *
 * @param {string} target 待判断路径。
 * @returns {boolean} 是目录返回 true。
 */
function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 判断路径是不是普通文件。
 *
 * @param {string} target 待判断路径。
 * @returns {boolean} 是文件返回 true。
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
 * @param {string} filePath JSON 文件路径。
 * @returns {object|null} 解析结果,失败返回 null。
 */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 版本号归一化:去掉前导 `v`,大小写不敏感。
 *
 * @param {unknown} value 原始版本号。
 * @returns {string|null} 归一化后的版本号,无效返回 null。
 */
function normalizeVersion(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^v/i, '');
}

/**
 * 列出某个安装根目录下所有应用自带的 aioncore 整包目录。
 *
 * 不按应用名过滤 —— 装了哪个版本的产品名可能变(`BadouWorklocal`、
 * `BadouWork-Dev`……),而「哪个 app 里带了 aioncore 整包」这件事本身才是
 * 我们要找的。
 *
 * @param {string} appRoot 安装根目录。
 * @param {string} platform Node 平台名。
 * @param {string} runtimeKey 形如 `darwin-x64`。
 * @returns {string[]} 整包目录绝对路径(可能不存在,调用方要自己判断)。
 */
function listBundleDirsUnder(appRoot, platform, runtimeKey) {
  let entries;
  try {
    entries = fs.readdirSync(appRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = [];
  for (const entry of entries) {
    const appDir = path.join(appRoot, entry.name);
    if (!isDirectory(appDir)) continue;
    if (platform === 'darwin') {
      if (!entry.name.endsWith('.app')) continue;
      dirs.push(path.join(appDir, 'Contents', 'Resources', 'bundled-aioncore', runtimeKey));
    } else {
      dirs.push(path.join(appDir, 'resources', 'bundled-aioncore', runtimeKey));
    }
  }
  return dirs;
}

/**
 * 整包是否「完整可用」。
 *
 * 三个要件缺一不可:二进制本体、`managed-resources/` 的契约、整包 manifest。
 * 少任何一个都不能直接用 —— 少了二进制跑不起来,少了契约过不了
 * `verifyPreparedAioncoreBundle`,少了 manifest 无从判断版本。
 *
 * @param {string} dir 整包目录。
 * @param {string} binaryName 二进制文件名。
 * @returns {boolean} 完整返回 true。
 */
function isCompleteAioncoreBundle(dir, binaryName) {
  return (
    isFile(path.join(dir, binaryName)) &&
    isFile(path.join(dir, 'managed-resources', 'manifest.json')) &&
    isFile(path.join(dir, 'manifest.json'))
  );
}

/**
 * 找一份本机上现成可用的 aioncore 整包。
 *
 * 候选按优先级:
 *
 * 1. 仓库里的构建缓存 `resources/bundled-aioncore/<platform>-<arch>/`
 * 2. 本机已装应用自带的整包
 *
 * 每一项都要**版本与请求版本一致**才采用。
 *
 * @param {object} options 选项。
 * @param {string} options.projectRoot 仓库根目录。
 * @param {string} options.platform Node 平台名,如 `'darwin'`。
 * @param {string} options.arch 目标架构,如 `'x64'`。
 * @param {string} options.version 期望的版本号,形如 `'v0.1.63'`;`latest` 之类无法比对的返回 null。
 * @param {string} [options.binaryName] 二进制文件名,默认按平台取。
 * @param {string[]} [options.appRoots] 已装应用的安装根目录,默认按平台取真实路径(测试可注入)。
 * @returns {{ dir: string, kind: string, version: string }|null} 命中的整包,没有则 null。
 */
function resolveOfflineAioncoreBundle(options) {
  const {
    projectRoot,
    platform,
    arch,
    version,
    binaryName = platform === 'win32' ? 'aioncore.exe' : 'aioncore',
    appRoots = listAppInstallRoots(platform),
  } = options;

  const runtimeKey = `${platform}-${arch}`;
  const expected = normalizeVersion(version);
  // 版本无从比对(比如 'latest')时不能用离线包 —— 宁可去下载也不猜。
  if (!expected) return null;

  const candidates = [
    {
      dir: path.join(projectRoot, 'resources', 'bundled-aioncore', runtimeKey),
      kind: 'repo-cache',
    },
  ];
  for (const root of appRoots) {
    for (const dir of listBundleDirsUnder(root, platform, runtimeKey)) {
      candidates.push({ dir, kind: 'installed-app' });
    }
  }

  for (const candidate of candidates) {
    if (!isCompleteAioncoreBundle(candidate.dir, binaryName)) continue;
    const manifest = readJson(path.join(candidate.dir, 'manifest.json'));
    if (!manifest) continue;
    if (manifest.platform && manifest.platform !== platform) continue;
    if (manifest.arch && manifest.arch !== arch) continue;
    if (normalizeVersion(manifest.version) !== expected) continue;
    return { dir: candidate.dir, kind: candidate.kind, version: manifest.version };
  }
  return null;
}

module.exports = {
  isCompleteAioncoreBundle,
  listAppInstallRoots,
  listBundleDirsUnder,
  normalizeVersion,
  resolveOfflineAioncoreBundle,
};
