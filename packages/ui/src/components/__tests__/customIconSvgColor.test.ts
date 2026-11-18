/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 守卫:定制图标的 SVG **不能写死颜色**。
 *
 * 为什么
 * ====
 * 定制图标是组件(不是 `<img src>`),颜色由 `AppIcon` 的 `fill` 与外层 `<svg>` 的
 * `style.color` 统一给 —— 路径上写 `fill="#1A65FF"` 的话,那一笔就永远是这个蓝,
 * 既不跟随明暗主题,也不跟随按钮的文字色,`fill` / 样式都改不动它。
 *
 * 检查方式直接复用构建期转换器(`convertSvgToComponent`)的判定 ——
 * 转换器遇到写死的颜色本来就会打提示,这里把它变成一道会失败的测试。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { convertSvgToComponent } from '../../vite/svgToReact';

const SVG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../icons/svg');

const SVG_FILES = readdirSync(SVG_DIR).filter((file) => file.endsWith('.svg'));

describe('定制图标 SVG', () => {
  it('目录里有 SVG 源文件', () => {
    expect(SVG_FILES.length).toBeGreaterThan(0);
  });

  for (const file of SVG_FILES) {
    it(`${file} 没有写死的颜色`, () => {
      const source = readFileSync(path.join(SVG_DIR, file), 'utf-8');
      const { warnings } = convertSvgToComponent(source, { name: 'probe', factoryImport: './customIcons' });

      expect(warnings, `${file} 写死了颜色 —— 改成 currentColor,颜色才能跟着 fill / 样式走`).toEqual([]);
    });
  }
});
