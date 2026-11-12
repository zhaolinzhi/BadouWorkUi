/**
 * @aionui/microapp-shared — 公共包 barrel
 *
 * 面向 packages/microapps/* 下子应用共享的 qiankun 生命周期辅助:
 *   - `setActiveProps` / `clearActiveProps` / `emitAuthExpired`:把当前 micro-app
 *     的 MicroAppProps 缓存到模块级,供异步上下文(如 fetch 拦截器、401 处理)取回。
 *   - `createAppContext`:把 props 镜像到 `${systemCode}_*` localStorage 键,
 *     作为离线 / 降级场景下的兜底。
 *   - `createIpcResolver<TBridge>`:在 qiankun 沙箱下拿到主进程注入到真 window 的
 *     `window.ipcBridge.<feature>`,绕过沙箱 Proxy 的间接 eval 桥接工厂。
 *   - `getRouter` / `useRouter`:子应用内存路由器的按 base 缓存单例 —— 避免在
 *     React render 阶段反复创建 router(那是「第二次打开子应用」崩溃的根因,
 *     见 ./qiankun/router.ts)。
 *   - `loadStandaloneStyles` / `resolveStandaloneTheme` / `applyStandaloneTheme`:
 *     独立运行(dev 直开子应用)时补上 shell 的样式与明暗主题。
 *
 * 此处 re-export `@renderer/micro-app/types` 的类型,消费方可以从
 * `@aionui/microapp-shared` 单一 import 点拿到 props 类型 + 辅助函数,避免
 * 跨包路径泄漏。
 */
export { setActiveProps, clearActiveProps, emitAuthExpired } from './qiankun/auth';
export { createAppContext } from './qiankun/adapter';
export { createIpcResolver, __clearIpcResolverCacheForTests } from './qiankun/ipc';
export { adoptShellI18n } from './qiankun/i18n';
export type { AdoptableI18n } from './qiankun/i18n';
export { clearAppLocalStorage, createMicroAppRenderer, isQiankunHost, resolveMountContainer } from './qiankun/mount';
export type { MountContainer, MicroAppRenderer, RenderProps } from './qiankun/mount';
export { getRouter, useRouter, __clearRouterCacheForTests } from './qiankun/router';
export type { MemoryRouter, RouterFactory } from './qiankun/router';
export type { MicroAppProps, MicroAppUserInfo } from './qiankun/types';
export { applyStandaloneTheme, loadStandaloneStyles, resolveStandaloneTheme } from './standalone';
export type { StandaloneTheme } from './standalone';
