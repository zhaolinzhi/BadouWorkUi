/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 全局注册的共享组件 —— 类型侧声明。
 *
 * 运行时靠构建期注入(见 `./vite/globalComponentsPlugin.ts`),类型期靠这里:
 * 没有它,TS 会报 `Cannot find name 'AppIcon'`。
 *
 * 用 `declare global` 而不是往 `JSX.IntrinsicElements` 里塞:这两个是**值**
 * (组件本身),不是内置标签 —— 内置标签必须是小写开头。
 *
 * `import type`:这里只要类型,不需要在运行时把组件引进来。
 */
import type { default as AppIconComponent } from './components/AppIcon';
import type { default as IconButtonComponent } from './components/IconButton';

declare global {
  /** 全局可用的图标组件 —— 实现见 `@aionui/ui` 的 `AppIcon`。 */
  const AppIcon: typeof AppIconComponent;
  /** 全局可用的图标按钮 —— 实现见 `@aionui/ui` 的 `IconButton`。 */
  const IconButton: typeof IconButtonComponent;
}
