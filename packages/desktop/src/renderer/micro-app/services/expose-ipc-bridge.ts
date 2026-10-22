/**
 * 把主应用的 `ipcBridge` 挂到真实 `window` 上,供 qiankun 子应用读取。
 *
 * 为什么需要这一步
 * ===============
 * 子应用的数据通道走 `window.ipcBridge.<feature>`,子应用侧用间接 eval
 * `(0, eval)('window')` 拿"真正的" global window(qiankun 用 Proxy 包装了
 * 子应用域的 `window`,直接读 `window.ipcBridge` 会拿到 undefined)。
 *
 * 但 `ipcBridge` 是 `@/common` 的**模块级导出**(`export * as ipcBridge from
 * './adapter/ipcBridge'`),从来没有人把它写到 window 上 —— preload 的
 * contextBridge 只暴露了 `electronAPI` / `__backendPort` / `__initialLanguage`
 * 等,不包含 `ipcBridge`。所以在补上这次赋值之前,`window.ipcBridge` 在
 * Electron 和 WebUI 下都是 undefined,子应用会在解析 bridge 时直接抛错。
 *
 * 为什么在 renderer 里赋值就够了
 * =============================
 * - renderer bundle 与 preload 通过 contextBridge 处在**同一个 main world**,
 *   renderer 里的 `window` 就是间接 eval 能拿到的那个 `window`,不需要
 *   contextBridge 中转(只有 isolated world → main world 才需要)。
 * - `ipcBridge.notebooks` / `ipcBridge.notes` 本身是 `httpGet` / `httpPost`
 *   provider,内部用 `getBaseUrl()` 解析:Electron 下是
 *   `http://127.0.0.1:<__backendPort>`,WebUI 下是同源相对路径。子应用不需要
 *   自己拼 `baseApi`,也就绕开了 `MicroAppHost` 默认值 `/api` 打到 Vite dev
 *   server 导致 404 的老问题。
 */
import { ipcBridge } from '@/common';
import { FLAVOR } from '@/common/config/flavor';

type BridgeCarrier = { ipcBridge?: unknown; __FLAVOR__?: unknown };

if (typeof window !== 'undefined') {
  const carrier = window as unknown as BridgeCarrier;
  // 幂等:模块可能被多次 import(HMR / lazy chunk 重复求值)
  if (!carrier.ipcBridge) {
    carrier.ipcBridge = ipcBridge;
  }
  /*
   * `FLAVOR` 是构建期常量,决定 AIPaaS 后端地址(enterprise / public 两套域名)。
   * 子应用要自己拼 `AIPAAS_BASE_URL` 发列表请求,而它的 webpack/vite 打包
   * 不共享 shell 的常量 —— 只能从 window 读。挂在这里是因为本文件已经是
   * 「把 shell 的模块级单例挂到真 window」的唯一入口,再开一个 expose 文件
   * 会让读代码的人漏掉其中之一。
   */
  if (!carrier.__FLAVOR__) {
    carrier.__FLAVOR__ = FLAVOR;
  }
}
