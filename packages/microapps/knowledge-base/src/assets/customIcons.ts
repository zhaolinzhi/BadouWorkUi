/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 微应用自己的定制图标工厂。
 *
 * `aionuiSvgIconPlugin` 编译 `*.svg?component` 时，会从 SVG 所在目录往上找
 * 一个叫 `customIcons.ts` / `customIcons.tsx` 的文件，生成
 * `import { createCustomIcon } from '<这个文件>'`。
 *
 * 本微应用的 SVG 在 `src/assets/svgs/` 下，所以工厂放在 `src/assets/` ——
 * 插件从 `svgs/` 往上一级就能找到。这里转发共享包的实现，不必抄一遍。
 *
 * 两类图标的区别（`src/assets/svgs/` 下的两种放法）：
 *
 * - `svgs/*.svg` —— **单色**描边图标，走这条 `?component` 管线。
 *   颜色由 `currentColor` 决定，随明暗主题与文字色变化。
 * - `svgs/mixed/*.svg` —— **多色**美术稿（Word 是蓝的、Excel 是绿的……），
 *   颜色画死在图形里，着不了色，只能用 `<img>` 按 URL 渲染
 *   （见 `components/kb/DocumentFileIcon.tsx`）。
 */
export { createCustomIcon } from '@aionui/ui';
export type { CustomIconOptions, CustomIconRenderProps } from '@aionui/ui';
