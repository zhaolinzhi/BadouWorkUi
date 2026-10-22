/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `app://` scheme 的特权声明。
 *
 * 这是一个**必须在 app.ready 之前跑完**的模块,所以做成 side-effect import:在
 * `src/index.ts` 的 import 区(和 `configureChromium` 同样式)引入即可,拿到模块求值
 * 的时机,不需要额外记得在 ready 回调里补一刀 —— 那种写法一旦漏掉,症状是运行时报
 * "scheme not registered",而日志里看不出是少了这一步。
 *
 * `registerSchemesAsPrivileged` 只对之后创建的 webContents 生效,Chromium 不允许在
 * ready 之后再补注册。
 *
 * Privileged-scheme declaration for `app://`.
 *
 * This module **must** finish before `app.ready`, so it is a side-effect import: pulling it
 * into the import block of `src/index.ts` (same shape as `configureChromium`) hooks module
 * evaluation itself, and nobody has to remember to add a call inside the ready callback —
 * forgetting that one only surfaces as a runtime "scheme not registered" with nothing in the
 * log pointing at the missing step.
 *
 * `registerSchemesAsPrivileged` only affects webContents created afterwards; Chromium does
 * not allow registering later.
 */

import { protocol } from 'electron';

/** scheme 名;entry 形如 `app://microapps/notes/index.html`。/ Scheme name; entries look like `app://microapps/notes/index.html`. */
export const MICRO_APP_SCHEME = 'app';

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
