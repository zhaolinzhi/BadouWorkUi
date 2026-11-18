/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { protocol } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMicroAppSchemePrivileges } from '../scheme';

vi.mock('electron', () => ({
  protocol: { registerSchemesAsPrivileged: vi.fn() },
}));

const registerSchemesAsPrivileged = vi.mocked(protocol.registerSchemesAsPrivileged);
/** 主进程入口,决定 `app://` 声明相对 `initSentry()` 的调用顺序。/ Main entry — fixes the call order of `app://` relative to `initSentry()`. */
const MAIN_ENTRY = path.resolve(__dirname, '../../../../index.ts');

describe('registerMicroAppSchemePrivileges', () => {
  beforeEach(() => {
    registerSchemesAsPrivileged.mockClear();
  });

  it('declares app:// as a fetchable, secure scheme so qiankun can pull the micro app entry', () => {
    registerMicroAppSchemePrivileges();

    const [[schemes]] = registerSchemesAsPrivileged.mock.calls;
    expect(schemes[0].scheme).toBe('app');
    expect(schemes[0].privileges).toMatchObject({
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    });
  });

  /*
   * 回归点:只保住 `standard` / `stream` 是不够的。丢掉 `supportFetchAPI`(或 secure /
   * corsEnabled)时渲染进程的 fetch() 会直接报 `URL scheme "app" is not supported` —— 而
   * 这正是 Sentry 覆盖开关后 `app://` 剩下的样子,所以这里逐条钉住。
   *
   * Regression guard: keeping only `standard` / `stream` is not enough. Losing
   * `supportFetchAPI` (or secure / corsEnabled) is what makes the renderer's fetch() fail
   * with `URL scheme "app" is not supported` — the exact state Sentry's overwrite leaves
   * `app://` in, hence one assertion per privilege.
   */
  it('does not settle for the privileges that survive a partial overwrite', () => {
    registerMicroAppSchemePrivileges();

    const [[schemes]] = registerSchemesAsPrivileged.mock.calls;
    expect(schemes[0].privileges).not.toMatchObject({ supportFetchAPI: false });
    expect(schemes[0].privileges).not.toMatchObject({ secure: false });
    expect(schemes[0].privileges).not.toMatchObject({ corsEnabled: false });
  });
});

describe('app:// registration order in the main process entry', () => {
  const source = fs.readFileSync(MAIN_ENTRY, 'utf8');

  /*
   * 回归点(整个 bug 的根因):`@sentry/electron` 的 init() 自己会调一次
   * registerSchemesAsPrivileged([sentry-ipc]),Electium 按这次调用的 scheme 列表重建
   * `--fetch-schemes` 等开关,后写的覆盖先写的。声明排在 initSentry() 之前时,
   * `app://` 的 fetch / secure / cors 特权会被 sentry 那次调用整体抹掉,打包态渲染进程
   * 拉子应用 entry 直接失败(dev 走 localhost 所以看不出来)。
   *
   * Regression guard for the root cause: `@sentry/electron`'s init() calls
   * registerSchemesAsPrivileged([sentry-ipc]) itself and Electron rebuilds
   * `--fetch-schemes` and friends from that call's scheme list, so a later call overwrites
   * an earlier one. Declaring before initSentry() lets Sentry wipe the fetch / secure / cors
   * privileges off `app://`, and the packaged renderer then fails to pull a micro app entry
   * (dev hides this because it loads entries from localhost).
   */
  it('registers app:// after initSentry(), so Sentry cannot drop its fetch privilege', () => {
    const sentryInit = source.indexOf('initSentry();');
    const schemeRegistration = source.indexOf('registerMicroAppSchemePrivileges();');

    expect(sentryInit).toBeGreaterThan(-1);
    expect(schemeRegistration).toBeGreaterThan(sentryInit);
  });

  it('registers through that call rather than a side-effect import that runs too early', () => {
    expect(source).not.toMatch(/import\s+['"].*microApps\/scheme['"]/);
  });
});
