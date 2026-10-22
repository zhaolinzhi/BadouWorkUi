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
 * 目录根用 `app.getAppPath()` 而不是 `__dirname`:主 bundle 一旦被 code-split 进
 * `out/main/chunks/`,`__dirname` 就会偏一级(同款坑见 `initStorage.ts` 的
 * `getBuiltinMcpBaseDir`)。`getAppPath()` 打包后是 `…/app.asar`、dev 下是仓库根,
 * 两种情况拼出来的都是对的 `out/renderer/microapps`。
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
 * The directory root comes from `app.getAppPath()` rather than `__dirname`: once the main
 * bundle is code-split into `out/main/chunks/`, `__dirname` lands one level off (same trap
 * as `getBuiltinMcpBaseDir` in `initStorage.ts`). `getAppPath()` is `…/app.asar` when
 * packaged and the repo root in dev, and both produce the correct `out/renderer/microapps`.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { app, protocol } from 'electron';
import { getContentType, MICRO_APP_HOST, resolveMicroAppAssetPath } from './assets';
import { MICRO_APP_SCHEME } from './scheme';

/** `out/renderer/microapps` —— 子应用在产物里的落位,构建脚本负责写。/ Where builds put micro apps; the build script owns this. */
export const MICRO_APP_ASSET_SUBDIR = path.join('out', 'renderer', 'microapps');

/** 子应用资源根目录。/ Root directory of the bundled micro app assets. */
export const getMicroAppAssetRoot = (): string => path.join(app.getAppPath(), MICRO_APP_ASSET_SUBDIR);

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

export { MICRO_APP_SCHEME } from './scheme';
export { MICRO_APP_HOST, getContentType, resolveMicroAppAssetPath } from './assets';
