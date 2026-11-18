/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `*.svg?component` —— 把 SVG 文件编译成 React 图标组件的类型声明。
 *
 * 运行时由构建期插件完成(见 `./vite/svgIconPlugin.ts`),类型期靠这里。
 *
 * 为什么带 `?component` 查询参数
 * ============================
 * 仓库里还有别的 `.svg` 导入是**当 URL 用的**(`<img src={...}>`),
 * 全局声明 `*.svg` 会把那些也变成组件、类型直接对不上。
 * 带查询参数只匹配「要图标组件」的那种导入。
 *
 * ⚠️ 这个文件**不能有顶层 import/export** —— 有的话它就变成模块,
 * `declare module '*.xxx'` 会被当成「模块增强」而不是「环境模块声明」,
 * TS 会报 "Invalid module name in augmentation"。
 */

/**
 * 注意:这里刻意用 `import type` 从 `./components/icons` 取类型 ——
 * 那边反过来会 import 本模块的产物,但那只是**值**的引用,类型上互不矛盾。
 */
declare module '*.svg?component' {
  import type { AppIconComponent } from './components/icons';

  /** 编译产物 —— 一个与 icon-park 图标行为一致的定制图标组件。 */
  const component: AppIconComponent;
  export default component;
}
