/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 图标语义名 → 图标组件的映射表。
 *
 * 为什么要有映射表
 * ===============
 * 主应用的图标由构建期的 `iconParkPlugin`(`packages/desktop/electron.vite.config.ts`)
 * 自动套上 `IconParkHOC`,强制 size=16 / strokeWidth=3 / fill=固定色;
 * 三个微应用没装这个 plugin,图标是裸的 —— 描边更粗、颜色跟随文字色、尺寸五花八门。
 * 共享层提供一张显式的映射表,让同一个语义在主应用与微应用里指向同一个图标、
 * 同一套渲染参数。
 *
 * 命名规则
 * ========
 * - 基础键 = icon-park 组件名的 kebab-case(`MoreOne` → `more-one`),心智负担最小。
 * - 产品语义别名指向已有图标(`knowledge-base` → `Book`),让业务代码写语义而不是形状。
 * - 定制图标(icon-park 里没有的)键名同样是 kebab-case。
 *
 * 维护约定:**静态 import** 具体图标,不能用 `import * as` 或 动态 import ——
 * 那会让整个图标库进 bundle,失去 tree-shaking。
 */
import {
  ArrowLeft,
  Book,
  BookOne,
  Delete,
  Download,
  Down,
  FileText,
  FolderOpen,
  Info,
  Microphone,
  MoreOne,
  Notes,
  Plus,
  Record,
  Refresh,
  Robot,
  Tips,
} from '@icon-park/react';
import type React from 'react';

import { CUSTOM_ICON_MAP } from './svg.generated';

/**
 * 图标组件类型。
 *
 * 直接从 icon-park 推导,**不手抄** `theme` 的取值联合 —— icon-park 没有从包根
 * 导出 `Theme`,手抄的那份会在上游新增主题时悄悄过期,而类型系统不会报警。
 * 所有 icon-park 图标共享同一个 `Icon` 类型,所以拿任意一个做推导即可。
 */
export type AppIconComponent = React.ComponentType<React.ComponentProps<typeof Notes>>;

/** 图标组件接收的 props —— 写自定义图标时按这个类型声明。 */
export type AppIconComponentProps = React.ComponentProps<AppIconComponent>;

/**
 * icon-park 自带的图标 —— **手工维护**。
 *
 * 定制图标不在这里:它们由构建期扫描 `./svg/` 目录自动生成
 * (见 `./svg.generated.ts`),放进 SVG 文件就能用,不用在这里加 import。
 */
export const ICON_PARK_MAP = {
  // —— 功能类(icon-park 组件名的 kebab-case)——
  'arrow-left': ArrowLeft,
  book: Book,
  'book-one': BookOne,
  delete: Delete,
  download: Download,
  down: Down,
  'file-text': FileText,
  'folder-open': FolderOpen,
  info: Info,
  'more-one': MoreOne,
  plus: Plus,
  refresh: Refresh,
  robot: Robot,
  tips: Tips,

  // —— 产品语义别名 ——
  notes: Notes,
  'knowledge-base': Book,
  recording: Microphone,
  record: Record,
  microphone: Microphone,
} as const satisfies Record<string, AppIconComponent>;

/**
 * 全产品可用的图标 —— icon-park 自带的 + 定制图标。
 *
 * 定制图标排在后面:同名时以定制图标为准(但这种撞名是设计事故,
 * 有守卫测试盯着,见 `__tests__/iconMapDoc.test.ts`)。
 */
export const ICON_MAP = {
  ...ICON_PARK_MAP,
  ...CUSTOM_ICON_MAP,
} as const satisfies Record<string, AppIconComponent>;

/** 可用的图标语义名。 */
export type AppIconName = keyof typeof ICON_MAP;
