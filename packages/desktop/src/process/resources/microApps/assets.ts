/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `app://` 协议的纯路径 / MIME 逻辑(不碰 Electron,便于单测)。
 *
 * 为什么需要这一层:子应用产物被打进安装包后位于 `app.asar/out/renderer/microapps/`,
 * 而打包态的渲染进程是 `file://` origin —— Chromium 里 `fetch('file://…')` 必然抛
 * TypeError,asar 内的路径也没有 URL 形态。主进程注册一个 `app://` scheme 把这个目录
 * 映射成可 fetch 的 URL,qiankun 的 import-html-entry 才能把子应用 entry 拉起来。
 *
 * Pure path/MIME logic for the `app://` protocol (no Electron dependency, so it can be
 * unit-tested).
 */

/**
 * Why this layer exists: a bundled micro app lives at `app.asar/out/renderer/microapps/`,
 * while the packaged renderer runs on a `file://` origin — `fetch('file://…')` throws in
 * Chromium, and paths inside an asar archive have no URL form. The main process registers
 * an `app://` scheme that maps that directory onto a fetchable URL, which is what lets
 * import-html-entry pull the micro app entry in.
 */

import path from 'node:path';

/** entry 在 `app://` 下的 host 段。/ The `app://` host segment used by micro app entries. */
export const MICRO_APP_HOST = 'microapps';

/** 子应用资源相对 app 根的落位,构建脚本负责写。/ Where builds put micro apps, relative to the app root. */
export const MICRO_APP_ASSET_SUBDIR = path.join('out', 'renderer', 'microapps');

/**
 * 从 `app.getAppPath()` 推出子应用资源根。
 *
 * 为什么不能直接 `path.join(app.getAppPath(), MICRO_APP_ASSET_SUBDIR)`:`getAppPath()` 在两种
 * 形态下指向完全不同的东西 —— 打包后是 `…/app.asar`(子目录就在它下面),而**未打包时是入口
 * 文件所在目录**(`out/main`),直接拼会得到 `out/main/out/renderer/microapps`,恒不存在。
 * 症状很隐蔽:协议注册成功、dev 下一切正常,只有「`bun run package` 之后直接起 Electron」
 * 这条验证路径会莫名其妙地全部 404。
 *
 * 这里用候选探测而不是 `app.isPackaged` 分支:前者对「main bundle 被 code-split 进
 * `out/main/chunks/`」这类层级变化免疫(同款坑见 `initStorage.ts` 的
 * `getBuiltinMcpBaseDir`),也不需要在纯函数里把 Electron 的 `isPackaged` 传进来。
 *
 * Resolves the micro app asset root from `app.getAppPath()`.
 *
 * A plain `path.join(app.getAppPath(), MICRO_APP_ASSET_SUBDIR)` is wrong because
 * `getAppPath()` points somewhere different per shape: `…/app.asar` when packaged (the assets sit
 * directly beneath it) but the **entry file's directory** (`out/main`) when not, which would
 * yield `out/main/out/renderer/microapps` — a path that never exists. The failure is easy to
 * miss: the protocol registers fine and everything works in dev, so only the "run Electron
 * straight after `bun run package`" verification path mysteriously 404s.
 *
 * Candidate probing beats branching on `app.isPackaged` here: it survives level shifts such as the
 * main bundle being code-split into `out/main/chunks/` (same trap as `getBuiltinMcpBaseDir` in
 * `initStorage.ts`), and it keeps Electron's `isPackaged` out of a pure function.
 *
 * @param appPath Value of `app.getAppPath()`.
 * @param exists Existence probe, injected so this stays testable without touching the disk.
 * @returns First candidate that exists, or the first candidate when none do (so the handler can
 *   answer 404 rather than throw on a build that has never produced assets).
 */
export const resolveMicroAppAssetRoot = (appPath: string, exists: (candidate: string) => boolean): string => {
  const candidates = [
    path.join(appPath, MICRO_APP_ASSET_SUBDIR),
    // 未打包时 appPath 是 out/main,回退两级才是仓库根。/ Unpackaged: out/main, so the project
    // root is two levels up.
    path.resolve(appPath, '..', '..', MICRO_APP_ASSET_SUBDIR),
  ];
  return candidates.find(exists) ?? candidates[0];
};

/**
 * 扩展名 → Content-Type。
 *
 * 只列子应用产物真正会用到的类型,而不是拉一张完整 MIME 表 —— 未列出的扩展名统一回落到
 * `application/octet-stream`,由 `getContentType` 兜底。
 *
 * `woff2` / `ttf` 是 UnoCSS 与 Arco 的图标字体;`svg` 在子应用里以图片和图标两种身份出现;
 * `.map` 留给 sourcemap(CI 打包关掉,不产)。
 *
 * Extension → Content-Type.
 *
 * Only types a micro app build actually emits are listed rather than pulling in a full MIME
 * table; anything unlisted falls back to `application/octet-stream` via `getContentType`.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

/** 按扩展名取 Content-Type,未知类型回落 octet-stream。/ Content-Type by extension, octet-stream otherwise. */
export const getContentType = (filePath: string): string =>
  CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';

/**
 * 把 `app://microapps/<name>/index.html` 的 pathname 解析成 root 下的绝对文件路径。
 *
 * 三道闸,缺一不可:
 * 1. **先 decode 再判穿越**。URL 的 pathname 是百分号编码的,`%2e%2e` 就是 `..`;
 *    先 decode 再挡才拦得住,顺序反了等于没拦。
 * 2. **丢掉开头的斜杠**而不是直接 `path.resolve(root, pathname)`。后者遇到绝对路径会
 *    整个把 root 顶掉 —— `/etc/passwd` 会变成真的 `/etc/passwd`。这里让绝对路径退化成
 *    root 下的相对路径,结果要么命中、要么 404,不会逃出 root。
 * 3. **`path.relative` 兜底**。前两步已经挡掉了显式的 `..`,但这一步仍然独立跑一遍:
 *    `relative` 同时认识 `/` 和 `\`,跨平台不用各写一份判断,而且万一将来有人改了前两步,
 *    这一层还在。
 *
 * 解析不出来(非法百分号编码、含 NUL、落在 root 之外)时返回 null,由调用方回 403。
 *
 * Resolve the pathname of `app://microapps/<name>/index.html` to an absolute file path
 * under `root`.
 *
 * Three gates, all required:
 * 1. **Decode before checking for traversal.** A URL pathname is percent-encoded, so
 *    `%2e%2e` is `..`; decoding first is the only order that actually blocks it.
 * 2. **Strip leading slashes** rather than calling `path.resolve(root, pathname)`. The
 *    latter lets an absolute path replace `root` wholesale, turning `/etc/passwd` into the
 *    real `/etc/passwd`. Stripping degrades absolute paths to paths under `root`, which
 *    either hit or 404 but can never escape.
 * 3. **`path.relative` as a backstop.** Steps 1–2 already reject explicit `..`, but this
 *    runs independently: `relative` understands both `/` and `\`, so there is no
 *    per-platform branch, and the guarantee survives someone editing the earlier steps.
 *
 * Returns null when the input cannot be resolved (malformed percent-encoding, embedded NUL,
 * or a path outside `root`); the caller answers 403.
 */
export const resolveMicroAppAssetPath = (root: string, pathname: string): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  // NUL 能截断路径,fs 层的行为在不同平台不一致,直接拒掉。
  // A NUL can truncate the path and fs behaviour differs per platform; reject outright.
  if (decoded.includes('\0')) return null;

  const normalizedRoot = path.resolve(root);
  const relative = decoded.replace(/^\/+/, '');
  if (relative === '') return null;

  const resolved = path.resolve(normalizedRoot, relative);
  const fromRoot = path.relative(normalizedRoot, resolved);
  if (fromRoot === '..' || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) {
    return null;
  }

  return resolved;
};
