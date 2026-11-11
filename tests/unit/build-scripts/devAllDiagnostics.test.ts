/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { formatExitDiagnosis, formatMissingPortWarning } =
  require('../../../packages/shared-scripts/src/dev-all-diagnostics.js') as {
    formatExitDiagnosis: (options: {
      kind: 'shell' | 'microapp';
      label: string;
      code?: number | null;
      signal?: string | null;
    }) => string;
    formatMissingPortWarning: (options: { name: string; port: number }) => string;
  };

/**
 * `bun run dev:all` 的诊断文案。
 *
 * 这些文案存在的唯一理由:「已退出(退出码 1)」这行字说明不了任何事。
 * 最坑的失败形态是 node 版本过低 —— 子应用的 vite 秒崩(`Unexpected token '||='`),
 * dev-all 连带把其它几路一起收掉,最后只剩主应用活着、三个端口全空,
 * 界面上是微应用白屏。文案必须把「为什么」说出来,否则又要靠猜。
 */
describe('dev-all 诊断文案', () => {
  it('子应用退出时点明 node 版本过低这个最常见的原因', () => {
    const text = formatExitDiagnosis({ kind: 'microapp', label: 'app:notes', code: 1 });
    expect(text).toContain('app:notes');
    expect(text).toContain('退出码 1');
    expect(text).toContain('node');
    expect(text).toContain('Unexpected token');
    // 也要说清楚「其余进程被连带关掉了」,否则用户只会看到端口突然空了
    expect(text).toContain('连带关闭');
  });

  it('信号退出时如实写信号', () => {
    const text = formatExitDiagnosis({ kind: 'microapp', label: 'app:notes', code: null, signal: 'SIGTERM' });
    expect(text).toContain('信号 SIGTERM');
    expect(text).not.toContain('退出码 null');
  });

  it('主应用退出时不套用子应用那套说辞', () => {
    const shell = formatExitDiagnosis({ kind: 'shell', label: 'shell', code: 1 });
    const micro = formatExitDiagnosis({ kind: 'microapp', label: 'app:notes', code: 1 });
    expect(shell).toContain('shell');
    expect(shell).not.toContain('Unexpected token');
    expect(micro).toContain('Unexpected token');
  });

  it('端口没人监听时点名应用与端口,并给一条可执行的复核命令', () => {
    const text = formatMissingPortWarning({ name: 'notes', port: 7992 });
    expect(text).toContain('notes');
    expect(text).toContain('7992');
    expect(text).toContain('curl -s http://localhost:7992/');
  });
});
