/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 插件的 dev server 行为 —— 新增/删除 SVG 不用重启 dev server。
 *
 * 注册表是**构建期生成物**,生成发生在 `buildStart`(dev server 启动 / 构建时各一次)。
 * 只靠 `buildStart` 的话,dev 期间新丢一个 SVG 进去是不生效的 —— 得重启一遍。
 * 所以插件在 `configureServer` 里盯着 SVG 目录,变动就重新生成。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { aionuiSvgIconPlugin } from '../svgIconPlugin';

/** 临时目录 —— 用完就删。 */
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
});

/** 建一个临时的 `icons/` 目录,里面放一个 `svg/` 子目录。 */
function createTemporaryIconsDirectory(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-icons-'));
  temporaryDirectories.push(root);

  const iconsDirectory = path.join(root, 'icons');
  const svgDirectory = path.join(iconsDirectory, 'svg');
  fs.mkdirSync(svgDirectory, { recursive: true });

  for (const [fileName, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(svgDirectory, fileName), content, 'utf8');
  }

  return iconsDirectory;
}

type WatcherHandler = (filePath: string) => void;

/** 假 dev server —— 只实现插件用到的那几个方法。 */
function createFakeServer() {
  const handlers = new Map<string, WatcherHandler[]>();
  const watchedPaths: string[] = [];
  const reloads: unknown[] = [];

  const server = {
    watcher: {
      on(event: string, handler: WatcherHandler) {
        const existing = handlers.get(event) ?? [];
        existing.push(handler);
        handlers.set(event, existing);
      },
      add(filePath: string) {
        watchedPaths.push(filePath);
      },
    },
    ws: {
      send(payload: unknown) {
        reloads.push(payload);
      },
    },
    config: { logger: { info: vi.fn() } },
  };

  return {
    server,
    watchedPaths,
    reloads,
    /** 触发一次文件事件,返回有没有引起注册表变化。 */
    emit(event: string, filePath: string) {
      for (const handler of handlers.get(event) ?? []) handler(filePath);
    },
  };
}

/** 启动插件的 dev server 钩子,返回假 server 与事件触发器。 */
function startPlugin(iconsDirectory: string) {
  const plugin = aionuiSvgIconPlugin({ iconsDirectory });
  const fake = createFakeServer();

  const configureServer = plugin.configureServer as (server: unknown) => void;
  configureServer(fake.server);

  return fake;
}

describe('dev server 监听 SVG 目录', () => {
  it('显式盯着 SVG 目录 —— 它在工程根之外,Vite 不会自动 watch', () => {
    const iconsDirectory = createTemporaryIconsDirectory();
    const fake = startPlugin(iconsDirectory);

    expect(fake.watchedPaths).toContain(path.join(iconsDirectory, 'svg'));
  });

  it('新增 SVG 立刻重新生成注册表', () => {
    const iconsDirectory = createTemporaryIconsDirectory();
    const fake = startPlugin(iconsDirectory);

    const svgPath = path.join(iconsDirectory, 'svg', 'star-badge.svg');
    fs.writeFileSync(svgPath, '<svg />', 'utf8');
    fake.emit('add', svgPath);

    const registry = fs.readFileSync(path.join(iconsDirectory, 'svg.generated.ts'), 'utf8');
    expect(registry).toContain("import StarBadgeIcon from './svg/star-badge.svg?component';");
    expect(registry).toContain("  'star-badge': StarBadgeIcon,");
  });

  it('新增 SVG 后让页面重新加载 —— 否则浏览器还拿着旧的映射表', () => {
    const iconsDirectory = createTemporaryIconsDirectory();
    const fake = startPlugin(iconsDirectory);

    const svgPath = path.join(iconsDirectory, 'svg', 'star-badge.svg');
    fs.writeFileSync(svgPath, '<svg />', 'utf8');
    fake.emit('add', svgPath);

    expect(fake.reloads).toEqual([{ type: 'full-reload' }]);
  });

  it('删除 SVG 后注册表里也跟着去掉', () => {
    const iconsDirectory = createTemporaryIconsDirectory({ 'star-badge.svg': '<svg />' });
    const fake = startPlugin(iconsDirectory);

    const svgPath = path.join(iconsDirectory, 'svg', 'star-badge.svg');
    fs.rmSync(svgPath);
    fake.emit('unlink', svgPath);

    const registry = fs.readFileSync(path.join(iconsDirectory, 'svg.generated.ts'), 'utf8');
    expect(registry).toContain('export const CUSTOM_ICON_MAP = {} as const;');
  });

  it('非 SVG 文件变动不重新生成', () => {
    const iconsDirectory = createTemporaryIconsDirectory();
    const fake = startPlugin(iconsDirectory);

    // 注册表文件自己被改写 —— 不能因此再触发一次生成(会绕成死循环)。
    fake.emit('change', path.join(iconsDirectory, 'svg.generated.ts'));

    expect(fs.existsSync(path.join(iconsDirectory, 'svg.generated.ts'))).toBe(false);
    expect(fake.reloads).toEqual([]);
  });

  it('注册表内容没变就不重新加载页面', () => {
    const iconsDirectory = createTemporaryIconsDirectory({ 'star-badge.svg': '<svg />' });
    const fake = startPlugin(iconsDirectory);

    // 先生成一次,再触发同一个文件 —— 内容没变,不该惊动页面。
    const svgPath = path.join(iconsDirectory, 'svg', 'star-badge.svg');
    fake.emit('add', svgPath);
    expect(fake.reloads).toHaveLength(1);

    fake.emit('add', svgPath);
    expect(fake.reloads).toHaveLength(1);
  });
});
