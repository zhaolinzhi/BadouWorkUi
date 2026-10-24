/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `app://` scheme 的特权声明。
 *
 * **必须在 app.ready 之前、且必须在 `initSentry()` 之后调用**,所以它是一个显式函数而不是
 * side-effect import。后半句是踩过的坑:`@sentry/electron` 的 `init()` 自己会调一次
 * `protocol.registerSchemesAsPrivileged([sentry-ipc])`,而 Electron 是**按这次调用传入的
 * scheme 列表重建命令行开关**(`--fetch-schemes` / `--secure-schemes` / `--cors-schemes` /
 * `--bypasscsp-schemes`),后写的覆盖先写的。
 *
 * 如果本模块排在 sentry 前面求值,sentry 那次调用就把这四个开关整个换成只剩
 * `sentry-ipc`(`sentry-ipc` 没有 standard/stream,所以 `--standard-schemes` 和
 * `--streaming-schemes` 侥幸留着 `app`)——渲染进程命令行会长成:
 * `--standard-schemes=app ... --fetch-schemes=sentry-ipc ... --streaming-schemes=app`,
 * `app://` 于是既不能 fetch 也不是 secure context,现象是渲染进程报
 * `Fetch API cannot load app://microapps/notes/index.html. URL scheme "app" is not supported.`
 *
 * 改到 sentry 之后再调,本模块拿到的是 sentry 套上的 Proxy(它会把自己的 scheme 追加到
 * 传入列表里),两个 scheme 进同一次调用,开关一次建全,谁也覆盖不掉谁。
 *
 * Privileged-scheme declaration for `app://`.
 *
 * **Must be called before `app.ready` and after `initSentry()`**, so it is an explicit
 * function rather than a side-effect import. The second half is a trap we hit:
 * `@sentry/electron`'s `init()` calls `protocol.registerSchemesAsPrivileged([sentry-ipc])`
 * itself, and Electron **rebuilds the command-line switches from the scheme list passed to
 * that call** (`--fetch-schemes` / `--secure-schemes` / `--cors-schemes` /
 * `--bypasscsp-schemes`), so a later call overwrites an earlier one.
 *
 * If this module is evaluated before Sentry, that later call replaces those four switches
 * with `sentry-ipc` alone (`sentry-ipc` carries no standard/stream privilege, which is why
 * `--standard-schemes` and `--streaming-schemes` happen to keep `app`). The renderer then
 * starts with `--standard-schemes=app ... --fetch-schemes=sentry-ipc ...`, `app://` is
 * neither fetchable nor a secure context, and the failure surfaces as
 * `Fetch API cannot load app://microapps/notes/index.html. URL scheme "app" is not supported.`
 *
 * Called after Sentry, this goes through the Proxy Sentry installed (it appends its own
 * scheme to the list we pass), both schemes land in a single call, and the switches are
 * built complete.
 */

import { protocol } from 'electron';

/** scheme 名;entry 形如 `app://microapps/notes/index.html`。/ Scheme name; entries look like `app://microapps/notes/index.html`. */
export const MICRO_APP_SCHEME = 'app';

/**
 * 声明 `app://` 的特权。调用点见 `src/index.ts` 中紧跟 `initSentry()` 的那一行。
 *
 * Declare the `app://` privileges. See the call right after `initSentry()` in `src/index.ts`.
 */
export const registerMicroAppSchemePrivileges = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MICRO_APP_SCHEME,
      privileges: {
        /**
         * `standard: true` 让 Chromium 按 host + path 解析这个 scheme 的 URL。
         *
         * 少了它,`app://microapps/notes/index.html` 会被当成 opaque URL,
         * import-html-entry 解析 `./assets/x.js` 时拿不到正确的绝对地址。
         *
         * `standard: true` makes Chromium parse this scheme's URLs as host + path.
         *
         * Without it, `app://microapps/notes/index.html` is opaque and import-html-entry
         * cannot absolutise `./assets/x.js` against the entry URL.
         */
        standard: true,
        /**
         * `secure: true` 让它算 secure context,否则子应用里 `crypto.subtle`、
         * service worker 这类只在安全上下文可用的 API 会被拒。
         *
         * `secure: true` marks it a secure context, otherwise APIs gated on one — such as
         * `crypto.subtle` and service workers — are unavailable to the micro app.
         */
        secure: true,
        /** `supportFetchAPI` 让 fetch() 能用这个 scheme —— qiankun 拉 entry 靠的就是它。/ fetch() over this scheme, which is how qiankun pulls the entry. */
        supportFetchAPI: true,
        /**
         * 打包态渲染进程的 origin 是 `file://`(opaque origin),拉 `app://` 属于跨源请求。
         * 不开 `corsEnabled` 的话浏览器的 CORS 检查会直接把响应丢掉。响应本身带
         * `Access-Control-Allow-Origin`,由 protocol handler 加。
         *
         * The packaged renderer runs on a `file://` (opaque) origin, so fetching `app://` is
         * cross-origin. Without `corsEnabled` the browser's CORS check discards the response.
         * The handler adds `Access-Control-Allow-Origin` to what it returns.
         */
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
};
