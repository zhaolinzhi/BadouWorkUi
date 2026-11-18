/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone(直接 `vite dev` 打开 7993)时的内存假 bridge
 *
 * 背景
 * ====
 * knowledge-base 的数据通道是宿主注入的 `window.ipcBridge`。独立运行时没有宿主
 * (也没有 Electron 主进程),bridge 根本不存在 —— `utils/ipc.ts` 的 resolver 会
 * 直接抛错(`ipcBridge.xxx is unavailable`)。而 `agentTypes` / `agentLogo` 在
 * **渲染期**就会去取 `acpConversation.getManagedAgents`,于是整页被 React error
 * boundary 接管,报 "Unexpected Application Error!"。
 *
 * 做法
 * ====
 * 独立运行时由 `main.ts` 把这份假 bridge 装到 `window.ipcBridge` 上 ——
 * 相当于「自己当自己的宿主」。装完之后 resolver 的间接 eval 分支照样命中,
 * 页面正常渲染,调 UI 不需要起 Electron + 后端。
 *
 * 边界
 * ====
 * - 只在 dev 装(见 `main.ts` 里的 `import.meta.env.DEV` 判断):生产产物由宿主
 *   提供真 bridge,万一脱离宿主直接打开,宁可报错也不要拿假数据糊弄人。
 * - 宿主已经注入过 bridge 时不覆盖(见 `installStandaloneMockBridge`)。
 * - 只覆盖 knowledge-base 真正用到的四个 namespace,其余 bridge 方法不提供 ——
 *   用到就会照常报错,不会悄悄给出假结果。
 */
import type { AcpConversationBridge, DialogBridge, FsBridge, ShellBridge } from '../utils/ipc';

/**
 * 造一份内存 bridge。方法签名与 `utils/ipc.ts` 声明的
 * `DialogBridge` / `FsBridge` / `ShellBridge` / `AcpConversationBridge` 严格对齐。
 *
 * 语义:
 *   - `dialog.showOpen`      —— 独立运行没有文件选择器,一律当作"用户取消"
 *   - `fs.getImageBase64`    —— 读不到本地文件,返回 null
 *   - `shell.openExternal`   —— 独立运行不跳外部浏览器,只打一条日志
 *   - `acpConversation.getManagedAgents` —— 没有 agent 目录,返回空数组
 */
export function createStandaloneMockBridge(): {
  dialog: DialogBridge;
  fs: FsBridge;
  shell: ShellBridge;
  acpConversation: AcpConversationBridge;
} {
  return {
    dialog: {
      showOpen: {
        invoke: async () => undefined,
      },
    },
    fs: {
      getImageBase64: {
        invoke: async () => null,
      },
    },
    shell: {
      openExternal: {
        invoke: async (url: string) => {
          // 独立运行时不该把用户带离当前页面,只留一条日志便于调试。
          // eslint-disable-next-line no-console
          console.info('[knowledge-base standalone dev] openExternal ignored:', url);
        },
      },
    },
    acpConversation: {
      getManagedAgents: {
        invoke: async () => [],
      },
    },
  };
}

/**
 * 把内存假 bridge 装到 `window.ipcBridge` 上。
 *
 * 宿主(shell)已经注入过 bridge 时**不覆盖** —— 真数据优先。
 *
 * @returns 是否真的装上了(没装 = 宿主已经有真 bridge,或不在浏览器环境)。
 */
export function installStandaloneMockBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const carrier = window as unknown as { ipcBridge?: Record<string, unknown> };
  const existing = carrier.ipcBridge;
  if (existing && existing.dialog) return false;

  const bridge = createStandaloneMockBridge();
  // `...existing`:existing 是 undefined 时展开也不会报错(等价于展开空对象)
  carrier.ipcBridge = { ...existing, ...bridge };
  // eslint-disable-next-line no-console
  console.info('[knowledge-base] standalone dev: using in-memory mock bridge');
  return true;
}
