/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildGatekeeperWarning } = require('../../../scripts/afterSign.js') as {
  buildGatekeeperWarning: (appName: string, signedWithDeveloperId: boolean) => string | null;
};

/**
 * 构建期就要把「Gatekeeper 会拦」这件事说清楚。
 *
 * 本机构建出来的 app 只有 ad-hoc 签名(机器上没有 Developer ID 证书时的兜底),
 * 通过微信 / 邮件 / 浏览器传给别人时,对方的 macOS 会弹「无法打开,因为它来自身份
 * 不明的开发者」。这个现象在构建机上完全看不出来,只有收包的人会撞上 —— 所以
 * 提示必须出现在构建日志里,而不是等别人来问。
 */
describe('Gatekeeper 提示', () => {
  it('有 Developer ID 签名时不提示', () => {
    expect(buildGatekeeperWarning('BadouWorklocal', true)).toBeNull();
  });

  it('只有 ad-hoc 签名时,提示里要给出对方的处置动作', () => {
    const warning = buildGatekeeperWarning('BadouWorklocal', false) ?? '';
    expect(warning).toContain('身份不明的开发者');
    expect(warning).toContain('xattr -cr /Applications/BadouWorklocal.app');
  });

  it('提示要点名 CI 需要配齐的 secret', () => {
    const warning = buildGatekeeperWarning('BadouWorklocal', false) ?? '';
    const secrets = [
      'BUILD_CERTIFICATE_BASE64',
      'P12_PASSWORD',
      'IDENTITY',
      'APPLE_ID',
      'APPLE_ID_PASSWORD',
      'TEAM_ID',
    ];
    for (const secret of secrets) {
      expect(warning, `提示里没有提到 ${secret}`).toContain(secret);
    }
  });
});
