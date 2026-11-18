/**
 * 跨包类型 re-export
 *
 * 把 shell 定义的 `MicroAppProps` / `MicroAppUserInfo` 镜像到 shared 包,
 * 子应用只需从 `@aionui/microapp-shared` 单点 import,避免在自己的 import
 * 路径里出现 `@renderer/micro-app/types`(那是 shell 内部路径,不该泄漏到
 * 消费方)。
 *
 * 实际类型定义仍在 `packages/desktop/src/renderer/micro-app/types.ts`,
 * shared 只是个薄透传层,不重复定义接口。
 */
export type { MicroAppProps, MicroAppUserInfo } from '@renderer/micro-app/types';
