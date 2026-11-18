/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 把安装包内的子应用目录注册成 `app://microapps/<name>/...`。
 *
 * 为什么不是别的方案:
 * - **不能靠 `file://`**:打包态渲染进程就在 `file://` 上,Chromium 里 fetch 一个
 *   `file://` URL 必然抛 TypeError(`--allow-file-access-from-files` 也不救 fetch,
 *   它只放开 XHR)。这条是死的。
 * - **不开本地 http 端口**:能work,但等于给整个应用开一个对外监听端口,而我们要的只是
 *   读几个打包进去的静态文件。`app://` 没有这个代价。
 *
 * 目录根由 `resolveMicroAppAssetRoot` 从 `app.getAppPath()` 推出来,而不是直接 join:
 * `getAppPath()` 未打包时是入口文件所在目录(`out/main`),直接拼会多出一级。详见该函数的
 * 注释。
 *
 * Registers the bundled micro app directory as `app://microapps/<name>/...`.
 *
 * Why not the alternatives:
 * - **`file://` is a dead end.** The packaged renderer already runs on `file://`, and
 *   fetching a `file://` URL throws in Chromium — `--allow-file-access-from-files` relaxes
 *   XHR only, not fetch.
 * - **A local http port would work**, but it opens a listening port for the whole app just to
 *   read a few static files that ship inside the package. `app://` costs nothing extra.
 *
 * The directory root is derived from `app.getAppPath()` by `resolveMicroAppAssetRoot` rather
 * than joined directly: unpackaged, `getAppPath()` is the entry file's directory (`out/main`),
 * so a plain join adds a spurious level. See that function's comment for the full story.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { app, protocol } from 'electron';
import { getContentType, MICRO_APP_HOST, resolveMicroAppAssetPath, resolveMicroAppAssetRoot } from './assets';
import { MICRO_APP_SCHEME } from './scheme';

/** 子应用资源根目录。/ Root directory of the bundled micro app assets. */
export const getMicroAppAssetRoot = (): string => resolveMicroAppAssetRoot(app.getAppPath(), existsSync);

/** 响应头。渲染进程 origin 是 file://,跨源 fetch 必须显式放行。/ The renderer is on file://, so cross-origin fetches need this explicitly. */
const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const respond = (status: number, body: string): Response =>
  new Response(body, { status, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });

const respondFile = async (filePath: string): Promise<Response> =>
  new Response(await readFile(filePath), {
    status: 200,
    headers: { ...BASE_HEADERS, 'Content-Type': getContentType(filePath) },
  });

/**
 * 注册 handler。可重复调用(热重载 / 测试),后一次会覆盖前一次。
 *
 * 有意**不** gate 在 `app.isPackaged`:这样 `bun run package` + `node
 * scripts/build-micro-apps.mjs` 之后直接起 Electron 就能验证 asar 布局,不必先花十几分钟
 * 打安装包。dev 下目录不存在时干净地回 404,不影响 `bun run dev`。
 *
 * Idempotent — a later call replaces the earlier handler (hot reload / tests).
 *
 * Deliberately **not** gated on `app.isPackaged`: it lets `bun run package` followed by
 * `node scripts/build-micro-apps.mjs` verify the asar layout by just launching Electron,
 * without spending a dozen minutes on an installer first. In dev the directory is absent and
 * the handler answers 404, which does not affect `bun run dev`.
 */
export const registerMicroAppAssetProtocol = (): void => {
  const root = getMicroAppAssetRoot();

  protocol.handle(MICRO_APP_SCHEME, async (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return respond(400, 'Bad micro app asset URL');
    }

    if (url.hostname !== MICRO_APP_HOST) return respond(404, `Unknown host: ${url.hostname}`);

    const filePath = resolveMicroAppAssetPath(root, url.pathname);
    if (filePath === null) return respond(403, 'Micro app asset path escapes its root');

    try {
      // existsSync 挡掉目录本身 —— 对目录 readFile 会抛 EISDIR,与其在异常里分辨,
      // 不如先确认它是个文件。
      // existsSync filters out directories; readFile on one throws EISDIR, and
      // distinguishing that from a genuine failure is more work than checking first.
      if (!existsSync(filePath)) return respond(404, `Micro app asset not found: ${url.pathname}`);
      return respondFile(filePath);
    } catch (error) {
      console.error(`[microApps] failed to serve ${url.pathname}:`, error);
      return respond(500, 'Failed to read micro app asset');
    }
  });

  if (!existsSync(root)) {
    // dev(`bun run dev`)下没有这个目录是正常的,只在打包形态下才是异常。
    // Normal under `bun run dev`; only notable in a packaged build.
    console.log(`[microApps] ${MICRO_APP_SCHEME}:// protocol registered (no assets at ${root})`);
  }
};

export { MICRO_APP_SCHEME, registerMicroAppSchemePrivileges } from './scheme';
export { MICRO_APP_HOST, MICRO_APP_ASSET_SUBDIR, getContentType, resolveMicroAppAssetPath } from './assets';
