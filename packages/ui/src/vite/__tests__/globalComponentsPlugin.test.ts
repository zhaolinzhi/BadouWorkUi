/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 全局注册插件的单元测试。
 *
 * 插件做的事只有一件:把「用了共享组件的 JSX 标签、但当前文件没 import 那个组件」
 * 的文件补上一行 import。判断错了会有两种后果,所以两类都要覆盖:
 *   - 少补 → 运行时 `ReferenceError: AppIcon is not defined`;
 *   - 多补 → 与已有的同名声明撞车,构建期直接报 duplicate identifier。
 */
import { describe, expect, it } from 'vitest';

import { aionuiGlobalComponentsPlugin, injectGlobalComponentImports } from '../globalComponentsPlugin';

type TransformHook = (code: string, id: string) => { code: string; map: null } | null;

const transformOf = (plugin: ReturnType<typeof aionuiGlobalComponentsPlugin>): TransformHook =>
  plugin.transform as unknown as TransformHook;

describe('injectGlobalComponentImports', () => {
  it('给没有 import 的共享组件标签补上 import', () => {
    const code = 'export const Demo = () => <AppIcon name="plus" />;\n';

    const result = injectGlobalComponentImports(code);

    expect(result).toContain("import { AppIcon } from '@aionui/ui';");
    // 补 import 不能动原代码
    expect(result).toContain('<AppIcon name="plus" />');
  });

  it('只补当前文件真正用到的组件', () => {
    const code = 'export const Demo = () => <IconButton icon={null} label="删除" />;\n';

    const result = injectGlobalComponentImports(code);

    expect(result).toContain("import { IconButton } from '@aionui/ui';");
    expect(result).not.toContain('AppIcon');
  });

  it('同一文件里用到两个组件时一起补', () => {
    const code = 'export const Demo = () => <IconButton icon={<AppIcon name="plus" />} label="删除" />;\n';

    const result = injectGlobalComponentImports(code);

    expect(result).toContain("import { AppIcon, IconButton } from '@aionui/ui';");
  });

  it('已经 import 过就不再补', () => {
    const code = "import { AppIcon } from '@aionui/ui';\nexport const Demo = () => <AppIcon name='plus' />;\n";

    expect(injectGlobalComponentImports(code)).toBe(code);
  });

  it('文件里有同名本地声明时不补', () => {
    const code = 'const AppIcon = () => null;\nexport const Demo = () => <AppIcon />;\n';

    expect(injectGlobalComponentImports(code)).toBe(code);
  });

  it('类型导入也算已绑定 —— 重复 import 会撞 duplicate identifier', () => {
    const code = "import type { AppIcon } from './types';\nexport const Demo = () => <AppIcon />;\n";

    expect(injectGlobalComponentImports(code)).toBe(code);
  });

  it('别名导入不占用原名,仍要补', () => {
    const code = "import { AppIcon as MyIcon } from '@aionui/ui';\nexport const Demo = () => <AppIcon />;\n";

    const result = injectGlobalComponentImports(code);

    expect(result).toContain("import { AppIcon } from '@aionui/ui';");
  });

  it('没用到共享组件的文件原样返回', () => {
    const code = 'export const demo = 1;\n';

    expect(injectGlobalComponentImports(code)).toBe(code);
  });

  it('补的 import 排在已有 import 之后,文件头注释不动', () => {
    const code = "/** @license */\nimport React from 'react';\n\nexport const Demo = () => <AppIcon />;\n";

    const result = injectGlobalComponentImports(code);

    expect(result.startsWith('/** @license */')).toBe(true);
    expect(result).toContain("import React from 'react';\nimport { AppIcon } from '@aionui/ui';");
  });
});

describe('aionuiGlobalComponentsPlugin', () => {
  it('改写用了共享组件的 JSX 文件', () => {
    const transform = transformOf(aionuiGlobalComponentsPlugin());

    const result = transform('export const Demo = () => <AppIcon name="plus" />;\n', '/app/src/Demo.tsx');

    expect(result?.code).toContain("import { AppIcon } from '@aionui/ui';");
  });

  it('不改写用不到的 JSX 文件', () => {
    const transform = transformOf(aionuiGlobalComponentsPlugin());

    expect(transform('export const demo = 1;\n', '/app/src/Demo.tsx')).toBeNull();
  });

  it('不改写非 JSX 文件', () => {
    const transform = transformOf(aionuiGlobalComponentsPlugin());

    expect(transform('export const demo = 1;\n', '/app/src/demo.ts')).toBeNull();
  });

  it('不改写 node_modules 里的文件', () => {
    const transform = transformOf(aionuiGlobalComponentsPlugin());

    expect(transform('export const Demo = () => <AppIcon />;\n', '/app/node_modules/x/index.tsx')).toBeNull();
  });

  it('带查询参数的模块 id 也按 JSX 文件处理', () => {
    const transform = transformOf(aionuiGlobalComponentsPlugin());

    const result = transform('export const Demo = () => <AppIcon />;\n', '/app/src/Demo.tsx?v=123');

    expect(result?.code).toContain("import { AppIcon } from '@aionui/ui';");
  });
});
