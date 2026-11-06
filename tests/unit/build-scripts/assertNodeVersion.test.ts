/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertNodeVersion, parseNodeMajor, readNodeEngineRange } =
  require('../../../packages/shared-scripts/src/assert-node-version.js') as {
    assertNodeVersion: (version?: string) => number;
    parseNodeMajor: (version: string) => number;
    readNodeEngineRange: (packageJsonPath?: string) => { min: number; max: number; raw: string };
  };

const REPO_ROOT = resolve(__dirname, '../../..');

/**
 * node 版本闸门。
 *
 * 构建脚本跑在 PATH 上的 node 上(`bun run` 不会把 node 换成 bun)。版本过低时
 * 失败方式极其隐蔽:子应用的 vite 构建抛 `||=` 语法错却仍返回退出码 0,
 * native 模块重建挂在别处,husky 的 prepare 报 "Unexpected token '||='"。
 * 闸门把这些统一成一条直指「node 太旧」的错误。
 */
describe('assertNodeVersion', () => {
  it('接受 engines 允许的版本', () => {
    expect(assertNodeVersion('v22.23.1')).toBe(22);
    expect(assertNodeVersion('22.0.0')).toBe(22);
    expect(assertNodeVersion('v24.9.0')).toBe(24);
  });

  it('拒绝低于 engines 下限的版本', () => {
    // node 14 上子应用构建会静默失败,node 20 上 vite 6 不受支持。
    // Node 14 makes the micro app build fail silently; node 20 is below vite 6's floor.
    expect(() => assertNodeVersion('v14.21.3')).toThrow(/node >= 22/);
    expect(() => assertNodeVersion('v20.20.2')).toThrow(/node >= 22/);
  });

  it('拒绝高于 engines 上限的版本', () => {
    expect(() => assertNodeVersion('v25.0.0')).toThrow(/node < 25/);
  });

  it('报错里带当前版本和修复动作', () => {
    // 报错必须自解释 —— 用户看到的第一条信息就是它。
    // The message has to stand on its own; it is the first thing the user sees.
    let message = '';
    try {
      assertNodeVersion('v14.21.3');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('v14.21.3');
    expect(message).toContain('nvm use 22');
  });

  it('版本串解析不出来时直接报错', () => {
    expect(parseNodeMajor('v22.23.1')).toBe(22);
    expect(parseNodeMajor('22.23.1')).toBe(22);
    expect(Number.isNaN(parseNodeMajor('not-a-version'))).toBe(true);
    expect(() => assertNodeVersion('not-a-version')).toThrow(/无法解析 node 版本/);
  });

  it('版本范围来自根 package.json 的 engines,不会和仓库声明脱节', () => {
    const range = readNodeEngineRange();
    const engines = (require(`${REPO_ROOT}/package.json`) as { engines?: { node?: string } }).engines?.node;
    expect(engines).toBeTruthy();
    expect(range.raw).toBe(engines);
    expect(range.min).toBe(22);
    expect(range.max).toBe(25);
  });
});
