/**
 * 活动 props 跟踪 — re-export 自 @aionui/microapp-shared
 *
 * 行为契约见 `packages/microapps/shared/src/qiankun/auth.ts`。
 * 此文件保留是为了避免在 main.ts 里改 import 路径(尽量减少 meeting-recording
 * 这次 PR 的 diff 面)。shared 包接管实现后,这里只做薄透传。
 */
export { setActiveProps, clearActiveProps, emitAuthExpired } from '@aionui/microapp-shared';
