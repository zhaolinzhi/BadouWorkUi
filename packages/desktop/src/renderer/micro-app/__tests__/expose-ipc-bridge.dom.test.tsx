/**
 * `expose-ipc-bridge` 的行为测试。
 *
 * 子应用(qiankun 沙箱内)用间接 eval `(0, eval)('window')` 读
 * `window.ipcBridge.notebooks`;shell 必须先把 `@/common` 的 `ipcBridge`
 * 写到 window 上,否则子应用解析 bridge 时会直接抛
 * "[notes microapp] ipcBridge.notebooks is unavailable"。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bridges = vi.hoisted(() => ({
  notebooks: { list: { invoke: vi.fn() } },
  notes: { list: { invoke: vi.fn() } },
}));

// 只 mock 聚合 barrel,避免把整个 ipcBridge 依赖树拉进测试
vi.mock('@/common', () => ({ ipcBridge: bridges }));

type BridgeCarrier = { ipcBridge?: Record<string, unknown> };

async function importExposeModule() {
  vi.resetModules();
  await import('../services/expose-ipc-bridge');
}

describe('expose-ipc-bridge', () => {
  beforeEach(() => {
    delete (window as unknown as BridgeCarrier).ipcBridge;
  });

  afterEach(() => {
    delete (window as unknown as BridgeCarrier).ipcBridge;
  });

  it('把 ipcBridge 挂到 window 上,子应用可直接读 notebooks / notes', async () => {
    await importExposeModule();

    const exposed = (window as unknown as BridgeCarrier).ipcBridge;
    expect(exposed).toBeDefined();
    expect(exposed?.notebooks).toBe(bridges.notebooks);
    expect(exposed?.notes).toBe(bridges.notes);
  });

  it('重复 import 幂等,不会覆盖已有引用', async () => {
    await importExposeModule();
    const first = (window as unknown as BridgeCarrier).ipcBridge;

    // 模拟 HMR / lazy chunk 重复求值
    await import('../services/expose-ipc-bridge');
    const second = (window as unknown as BridgeCarrier).ipcBridge;

    expect(second).toBe(first);
    expect(second).toBe(bridges);
  });

  it('不覆盖宿主已经挂好的自定义 bridge', async () => {
    const custom = { notebooks: { list: { invoke: vi.fn() } } };
    (window as unknown as BridgeCarrier).ipcBridge = custom;

    await importExposeModule();

    expect((window as unknown as BridgeCarrier).ipcBridge).toBe(custom);
  });
});
