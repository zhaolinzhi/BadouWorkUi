/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 定制图标注册表的生成逻辑。
 *
 * 覆盖三件事:
 * 1. 扫描规则(哪些文件会被登记、哪些被跳过);
 * 2. 生成出来的代码长什么样(必须是 oxfmt 格式化后的样子,否则文件会来回抖);
 * 3. 仓库里的 `svg.generated.ts` 与 `svg/` 目录是否同步。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { ICON_PARK_MAP } from '../../components/icons';
import {
  CUSTOM_ICON_REGISTRY_FILENAME,
  findIconsDirectory,
  renderCustomIconRegistry,
  scanCustomIcons,
  writeCustomIconRegistry,
} from '../customIconRegistry';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ICONS_DIRECTORY = path.join(PACKAGE_ROOT, 'src/components/icons');
const SVG_DIRECTORY = path.join(ICONS_DIRECTORY, 'svg');

/** 临时目录 —— 用完就删。 */
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
});

/** 建一个临时的 `icons/` 目录,里面放一个 `svg/` 子目录。 */
function createTemporaryIconsDirectory(files: Record<string, string>): string {
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

describe('扫描 SVG 目录', () => {
  it('登记目录里的 .svg 文件', () => {
    const iconsDirectory = createTemporaryIconsDirectory({
      'star-badge.svg': '<svg />',
      'brand.svg': '<svg />',
    });

    expect(scanCustomIcons(path.join(iconsDirectory, 'svg')).map((entry) => entry.name)).toEqual([
      'brand',
      'star-badge',
    ]);
  });

  it('忽略非 .svg 文件', () => {
    const iconsDirectory = createTemporaryIconsDirectory({
      'star-badge.svg': '<svg />',
      'README.md': '# 说明',
      'icon.ts': 'export default null;',
    });

    expect(scanCustomIcons(path.join(iconsDirectory, 'svg')).map((entry) => entry.name)).toEqual(['star-badge']);
  });

  it('忽略 `_` 前缀的文件 —— 那是「不自动登记」的标记', () => {
    const iconsDirectory = createTemporaryIconsDirectory({
      'star-badge.svg': '<svg />',
      '_sample-icon.svg': '<svg />',
    });

    expect(scanCustomIcons(path.join(iconsDirectory, 'svg')).map((entry) => entry.name)).toEqual(['star-badge']);
  });

  it('目录不存在时返回空数组', () => {
    expect(scanCustomIcons(path.join(os.tmpdir(), 'aionui-not-exists-at-all'))).toEqual([]);
  });
});

describe('生成注册表代码', () => {
  it('没有定制图标时导出空对象', () => {
    const code = renderCustomIconRegistry([]);

    expect(code).toContain('export const CUSTOM_ICON_MAP = {} as const;');
    expect(code).not.toContain('import');
  });

  it('每个图标一行 import、一行登记', () => {
    const code = renderCustomIconRegistry([
      { name: 'star-badge', fileName: 'star-badge.svg' },
      { name: 'brand', fileName: 'brand.svg' },
    ]);

    expect(code).toContain("import StarBadgeIcon from './svg/star-badge.svg?component';");
    expect(code).toContain("import BrandIcon from './svg/brand.svg?component';");
    expect(code).toContain("  'star-badge': StarBadgeIcon,");
    expect(code).toContain('  brand: BrandIcon,');
  });

  it('键名是合法标识符时不加引号 —— 必须与 oxfmt 的 quoteProps 一致', () => {
    const code = renderCustomIconRegistry([
      { name: 'plus', fileName: 'plus.svg' },
      { name: 'star-badge', fileName: 'star-badge.svg' },
    ]);

    // oxfmt 的 `quoteProps: "as-needed"`：合法标识符不加引号，其余加单引号。
    // 生成结果对不上，文件就会在「格式化」和「重新生成」之间来回抖。
    expect(code).toContain('  plus: PlusIcon,');
    expect(code).toContain("  'star-badge': StarBadgeIcon,");
  });

  it('标识符不能以数字开头', () => {
    const code = renderCustomIconRegistry([{ name: '3d-cube', fileName: '3d-cube.svg' }]);

    expect(code).toContain("import _3dCubeIcon from './svg/3d-cube.svg?component';");
  });

  it('规范化后同名的图标拿到不同标识符', () => {
    const code = renderCustomIconRegistry([
      { name: 'star-badge', fileName: 'star-badge.svg' },
      { name: 'star_badge', fileName: 'star_badge.svg' },
    ]);

    expect(code).toContain("import StarBadgeIcon from './svg/star-badge.svg?component';");
    expect(code).toContain("import StarBadgeIcon2 from './svg/star_badge.svg?component';");
  });
});

describe('写注册表文件', () => {
  it('把 SVG 目录的内容写进注册表', () => {
    const iconsDirectory = createTemporaryIconsDirectory({ 'star-badge.svg': '<svg />' });

    const result = writeCustomIconRegistry(iconsDirectory);

    expect(result.changed).toBe(true);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content).toContain("import StarBadgeIcon from './svg/star-badge.svg?component';");
    expect(content).toContain("  'star-badge': StarBadgeIcon,");
  });

  it('内容没变就不重写 —— dev server 不该被无意义的改动惊动', () => {
    const iconsDirectory = createTemporaryIconsDirectory({ 'star-badge.svg': '<svg />' });

    writeCustomIconRegistry(iconsDirectory);
    const second = writeCustomIconRegistry(iconsDirectory);

    expect(second.changed).toBe(false);
  });
});

describe('找 icons 目录', () => {
  it('从仓库根目录找得到', () => {
    expect(findIconsDirectory(PACKAGE_ROOT)).toBe(ICONS_DIRECTORY);
  });

  it('从仓库里的任意子目录往上找也找得到', () => {
    expect(findIconsDirectory(path.join(PACKAGE_ROOT, 'src/vite/__tests__'))).toBe(ICONS_DIRECTORY);
  });

  it('找不到时返回 null —— 插件照常工作,只是不生成注册表', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-outside-'));
    temporaryDirectories.push(root);

    expect(findIconsDirectory(root)).toBeNull();
  });
});

describe('仓库里的注册表', () => {
  it('与 svg/ 目录同步', () => {
    const expected = renderCustomIconRegistry(scanCustomIcons(SVG_DIRECTORY));
    const actual = fs.readFileSync(path.join(ICONS_DIRECTORY, CUSTOM_ICON_REGISTRY_FILENAME), 'utf8');

    expect(actual, '定制图标注册表与 svg/ 目录不同步 —— 启动一次 dev server 或构建即可重新生成').toBe(expected);
  });

  it('定制图标的名字不与 icon-park 的语义名撞车', () => {
    // 定制图标的名字要**从扫描结果**拿 —— 撞了车的话 ICON_MAP 里已经被它顶掉了,
    // 从 ICON_MAP 反推是发现不了的。
    const customNames = scanCustomIcons(SVG_DIRECTORY).map((entry) => entry.name);
    const collisions = customNames.filter((name) => name in ICON_PARK_MAP);

    expect(collisions, `定制图标 ${collisions.join('、')} 与 icon-park 的语义名撞车了 —— 换个不冲突的名字`).toEqual([]);
  });
});
