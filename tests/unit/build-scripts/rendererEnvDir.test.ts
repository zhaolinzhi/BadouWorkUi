/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const REPO_ROOT = resolve(__dirname, '../../..');
const DESKTOP_DIR = resolve(REPO_ROOT, 'packages/desktop');

/**
 * 渲染进程的 `.env` 解析。
 *
 * 背景:electron-vite 默认把渲染进程的 `envDir` 设成 `options.root || process.cwd()`,
 * 而 CLI(`electron-vite dev --config packages/desktop/electron.vite.config.ts`)没带
 * `[root]` 位置参数 —— 于是 envDir = 仓库根,那里一个 .env 都没有。
 * Vite 自己的 root 是 `packages/desktop/src/renderer`,那里也没有。
 *
 * 结果:`packages/desktop/.env.production` / `.env.development` 永远读不到,
 * 里面的 VITE_* 变量全部失效(文档 02-config.md 2.3.1 描述的加载顺序从未成立)。
 * 修法是在 electron.vite.config.ts 里显式设 `renderer.envDir`。
 */
describe('渲染进程的 env 解析', () => {
  it('electron.vite.config.ts 把 envDir 指到 packages/desktop', async () => {
    const { default: defineElectronConfig } = await import('../../../packages/desktop/electron.vite.config');
    const config = defineElectronConfig({ mode: 'development', command: 'serve' }) as {
      renderer?: { envDir?: string };
    };
    expect(config.renderer?.envDir).toBe(DESKTOP_DIR);
  });

  it('从该 envDir 能读到 .env.development 的微应用变量', () => {
    const dev = loadEnv('development', DESKTOP_DIR, 'VITE_');
    expect(dev.VITE_MICRO_APP_ENABLED).toBe('true');
    expect(dev.VITE_MICRO_APP_ASSET_BASE).toBe('');
  });

  it('从该 envDir 能读到 .env.production 的微应用变量', () => {
    const prod = loadEnv('production', DESKTOP_DIR, 'VITE_');
    expect(prod.VITE_MICRO_APP_ENABLED).toBe('true');
    expect(prod.VITE_MICRO_APP_ASSET_BASE).toBe('');
  });

  it('仓库根和 renderer root 下都没有 .env —— 这正是必须显式设 envDir 的原因', () => {
    expect(loadEnv('development', REPO_ROOT, 'VITE_')).toEqual({});
    expect(loadEnv('development', resolve(DESKTOP_DIR, 'src/renderer'), 'VITE_')).toEqual({});
  });

  it('构建时的 process.env 盖过 .env 文件 —— build:all 靠这条注入 app://microapps', () => {
    // .env.production 里 VITE_MICRO_APP_ASSET_BASE 是空的、ENABLED 是 true,而打包脚本
    // (build-with-builder.js)在构建前把 ASSET_BASE 写成 app://microapps。Vite 里
    // process.env 优先于 .env 文件 —— 注入才盖得住文件里的值。
    // 这里两个方向都验:ENABLED 从 true 盖成 false,ASSET_BASE 从空盖成 app://microapps。
    process.env.VITE_MICRO_APP_ENABLED = 'false';
    process.env.VITE_MICRO_APP_ASSET_BASE = 'app://microapps';
    try {
      const env = loadEnv('production', DESKTOP_DIR, 'VITE_');
      expect(env.VITE_MICRO_APP_ENABLED).toBe('false');
      expect(env.VITE_MICRO_APP_ASSET_BASE).toBe('app://microapps');
    } finally {
      delete process.env.VITE_MICRO_APP_ENABLED;
      delete process.env.VITE_MICRO_APP_ASSET_BASE;
    }
  });
});
