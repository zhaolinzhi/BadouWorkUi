/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone 内存假 bridge 的单测
 *
 * 覆盖两件事:
 *   1. 假 bridge 的语义跟宿主那侧对齐(取消选择 / 读不到图片 / 不跳外部浏览器 /
 *      没有 agent 目录);
 *   2. 装上之后,`utils/ipc.ts` 的 resolver 能真的拿到它 ——
 *      这是「standalone dev 不再整页崩掉」的关键一环。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearIpcResolverCacheForTests } from '@aionui/microapp-shared';
import { createStandaloneMockBridge, installStandaloneMockBridge } from '../standaloneMock';
import { ipcBridge } from '../../utils/ipc';

beforeEach(() => {
  __clearIpcResolverCacheForTests();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
});

describe('createStandaloneMockBridge', () => {
  it('treats the file picker as cancelled', async () => {
    const { dialog } = createStandaloneMockBridge();

    await expect(dialog.showOpen.invoke()).resolves.toBeUndefined();
  });

  it('reports that no local image can be read', async () => {
    const { fs } = createStandaloneMockBridge();

    await expect(fs.getImageBase64.invoke({ path: '/tmp/a.png' })).resolves.toBeNull();
  });

  it('keeps the user on the page when openExternal is called', async () => {
    const { shell } = createStandaloneMockBridge();

    await shell.openExternal.invoke('https://example.com');

    expect(console.info).toHaveBeenCalledWith(
      '[knowledge-base standalone dev] openExternal ignored:',
      'https://example.com'
    );
  });

  it('reports an empty agent directory', async () => {
    const { acpConversation } = createStandaloneMockBridge();

    await expect(acpConversation.getManagedAgents.invoke()).resolves.toEqual([]);
  });
});

describe('installStandaloneMockBridge', () => {
  it('makes the bridge resolvable through the knowledge-base ipc accessor', async () => {
    expect(installStandaloneMockBridge()).toBe(true);

    await expect(ipcBridge.dialog.showOpen.invoke()).resolves.toBeUndefined();
    await expect(ipcBridge.acpConversation.getManagedAgents.invoke()).resolves.toEqual([]);
  });

  it('does not overwrite a bridge the host already installed', () => {
    const hostBridge = { showOpen: { invoke: vi.fn() } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { dialog: hostBridge };

    expect(installStandaloneMockBridge()).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.dialog).toBe(hostBridge);
  });

  it('is idempotent — installing twice keeps the first bridge', async () => {
    installStandaloneMockBridge();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (window as any).ipcBridge.dialog;

    installStandaloneMockBridge();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.dialog).toBe(first);
  });
});
