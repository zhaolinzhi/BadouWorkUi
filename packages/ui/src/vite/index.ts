/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 全局注册插件的出口。
 *
 * 单独一个入口而不是从 `@aionui/ui` 的 barrel 里导 —— barrel 是给运行时用的
 * (React 组件),插件是给构建期用的,两者不该混在一起。
 *
 * ⚠️ **消费方要用相对路径 import**(`'../../ui/src/vite/index.ts'`),不能用包名
 * `'@aionui/ui/vite'`。原因:Vite 打包自己的配置文件时会把**所有裸包名**标成 external,
 * 于是配置文件运行时是 `require('@aionui/ui/vite')` —— 而包名指向的是 `.ts` 源码,
 * Node 加载不了,启动就报 "Unknown file extension"。相对路径则会被 esbuild 一起打包,
 * 顺带把 `typescript` 留在 external(它是裸包名),运行时才 require,不会打进产物。
 */
export {
  GLOBAL_COMPONENT_NAMES,
  GLOBAL_COMPONENT_SOURCE,
  aionuiGlobalComponentsPlugin,
  injectGlobalComponentImports,
} from './globalComponentsPlugin';
export type { GlobalComponentName, GlobalComponentsOptions } from './globalComponentsPlugin';

export { aionuiSvgIconPlugin } from './svgIconPlugin';
export type { SvgIconPluginOptions } from './svgIconPlugin';
export { convertSvgToComponent } from './svgToReact';
export type { ConvertSvgOptions, ConvertSvgResult, SvgElementNode } from './svgToReact';
export {
  CUSTOM_ICON_REGISTRY_FILENAME,
  findIconsDirectory,
  renderCustomIconRegistry,
  scanCustomIcons,
  writeCustomIconRegistry,
} from './customIconRegistry';
export type { CustomIconEntry } from './customIconRegistry';
