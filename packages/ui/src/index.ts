/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `@aionui/ui` — 主应用与 qiankun 微应用共用的 UI 组件层。
 *
 * 与 `@aionui/microapp-shared` 的分工:
 *   - `microapp-shared` 管**微应用运行时**(qiankun 生命周期、standalone 样式/主题、IPC 解析)。
 *   - `@aionui/ui` 管**界面**。它不依赖 `@renderer` / `@common`,依赖方向是单向的,
 *     所以主应用和微应用可以共用同一份实现。
 *
 * 硬性约束(新增组件前请先读):
 *   1. 不 import `@renderer` / `@common` / `@aionui/microapp-shared` —— 那些是主应用侧路径。
 *   2. 不注入全局 CSS、不带 preflight —— 微应用的样式会被搬进真实 document,
 *      `*` 选择器会污染 shell 页面。样式只用 CSS Module 或 UnoCSS 工具类。
 * 3. 颜色只用语义 token(`text-t-primary` / `bg-1` …),不硬编码色值。
 *   4. **组件自带零面向用户的文案** —— 文案由调用方用 `t(key, { defaultValue })`
 *      算好再传进来。共享包不在 shell 的 i18n 词条体系里,硬编码会违反项目规则。
 *   5. 不用 React Context 传跨应用状态 —— qiankun 下各应用各打各的 React,
 *      Context 不跨沙箱。跨应用状态走 props 或 CSS 变量。
 */
export {
  AppHeader,
  AppIcon,
  AsyncBoundary,
  ConfirmModal,
  CUSTOM_ICON_MAP,
  EmptyState,
  ICON_MAP,
  IconButton,
  MoreMenu,
} from './components';
export type {
  AppHeaderProps,
  AppIconComponent,
  AppIconComponentProps,
  AppIconName,
  AppIconProps,
  AsyncBoundaryProps,
  ConfirmModalProps,
  EmptyStateProps,
  IconButtonProps,
  MoreMenuItem,
  MoreMenuProps,
} from './components';

export { cx } from './utils/cx';
