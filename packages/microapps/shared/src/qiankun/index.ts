// 子路径 barrel:允许消费方写 `import { createIpcResolver } from '@aionui/microapp-shared/qiankun'`。
export { setActiveProps, clearActiveProps, emitAuthExpired } from './auth';
export { createAppContext } from './adapter';
export { createIpcResolver, __clearIpcResolverCacheForTests } from './ipc';
export { adoptShellI18n } from './i18n';
export type { AdoptableI18n } from './i18n';
export { clearAppLocalStorage, createMicroAppRenderer, isQiankunHost, resolveMountContainer } from './mount';
export type { MountContainer, MicroAppRenderer, RenderProps } from './mount';
export type { MicroAppProps, MicroAppUserInfo } from './types';
