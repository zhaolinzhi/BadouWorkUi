/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 定制图标 —— icon-park 里没有、单独设计的图标。
 *
 * 为什么要走 React 组件,而不是把 SVG 文件丢进 assets
 * ====================================================
 * `<img src='x.svg'>` 画出来的图标是**死的**:颜色写死在文件里、尺寸不随字号变、
 * 不跟随明暗主题 —— 这正是 `AppIcon` 要消灭的那类不一致。定制图标做成组件后,
 * 才能和 icon-park 图标共用同一套渲染参数(size / fill / strokeWidth)。
 *
 * 新增一个定制图标:两条路
 * ========================
 * 1. **把 SVG 丢进 `./svg/`** —— 构建期由 `aionuiSvgIconPlugin` 自动转成组件,
 *    并自动登记进 `ICON_MAP`(生成 `./svg.generated.ts`),转换规则由插件统一维护
 *    (见 `../../vite/svgToReact.ts`)。**不用改任何代码。推荐走这条。**
 * 2. **在本文件里手写组件** —— 图标结构特殊(要按条件渲染不同分支等)、
 *    或者要复用现有组件时用。这种要自己在 `./index.ts` 的 `ICON_MAP` 里登记。
 *
 * 两条路都要更新 `docs/contributing/ui-components/app-icon.md` 的「图标语义名全表」。
 *
 * SVG → 组件的转换规则(手写时也要遵守)
 * ======================================
 * 设计稿导出的 SVG 一般长这样:
 *
 * ```svg
 * <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
 *   <path d="M6.58 16.66C8.17 17.48 ..." stroke="currentColor" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
 * </svg>
 * ```
 *
 * 转换时只做四件事:
 *
 * 1. **保留 `d`**(以及 `fill-rule` 这类几何属性),**删掉 `stroke` / `stroke-width` /
 *    `stroke-linecap` / `stroke-linejoin`** —— 它们由外层 `<svg>` 统一提供,
 *    删掉才能让 `AppIcon` 的 `size` / `fill` / `strokeWidth` 真的生效。
 * 2. **`viewBox` 原样保留** —— 改了形状会变形。
 * 3. **硬编码的颜色(`fill="#86909C"`)要单独决定** —— 描边色统一由 `fill` prop 给;
 *    填充色若写死就不跟随主题,要么改成 `currentColor`,要么确认它就该是固定色。
 * 4. **属性名改成 JSX 的驼峰写法** —— `clip-path` → `clipPath`、`fill-rule` → `fillRule`,
 *    JSX 不接受带连字符的属性名,不改 React 会打警告。
 */
import React from 'react';

import { cx } from '../../utils/cx';
import type { AppIconComponent, AppIconComponentProps } from './index';

/**
 * icon-park 的画布宽(48)。
 *
 * 描边粗细是**画布单位**,不同 viewBox 的同一个数值视觉粗细完全不同 ——
 * 24 画布上 1.5 与 48 画布上 3 是同一个比例(6.25%)。统一按它换算,
 * `strokeWidth={3}` 在定制图标上才和 icon-park 图标一样粗。
 */
const ICON_PARK_CANVAS_WIDTH = 48;

export type CustomIconOptions = {
  /** 画布坐标系,原样抄 SVG 的 `viewBox`。 */
  viewBox: string;
  /**
   * 填充方式。描边型图标(默认)`none`;填充型图标 `currentColor`。
   *
   * 也可以写死一个具体颜色 —— 但那样就不跟随明暗主题了。
   */
  fill?: string;
  /** 线帽,默认 `round`(与 icon-park 一致)。 */
  strokeLinecap?: 'butt' | 'round' | 'square';
  /** 线角,默认 `round`(与 icon-park 一致)。 */
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  /**
   * 描边粗细的换算系数,默认 `viewBox 宽 / 48`。
   *
   * 设计稿本身的粗细比例与 icon-park 不同(比如 20 画布上 1.67 = 8.3%)时,
   * 传一个自定义系数保留设计稿的比例 —— 这时 `strokeWidth` 的含义就不再与其他图标一致。
   */
  strokeScale?: number;
};

/** 渲染函数拿到的参数 —— 都已经换算好,直接用。 */
export type CustomIconRenderProps = {
  /** 画布边长(px)。 */
  size: number | string;
  /** 描边色 —— 跟随文字色与明暗主题。 */
  fill: string;
  /** 换算后的描边粗细(画布单位)。 */
  strokeWidth: number;
};

/**
 * 造一个与 icon-park 图标**行为一致**的定制图标组件。
 *
 * 产出的组件 DOM 结构与 icon-park 一样:
 *
 * ```html
 * <span class="i-icon i-icon-<name>"><svg width height viewBox>…</svg></span>
 * ```
 *
 * 所以 `AppIcon` 不用区分两者 —— `size` / `fill` / `strokeWidth` / `className` /
 * `onClick` 的落点完全相同,微应用里也不会变成「裸图标」。
 */
export function createCustomIcon(
  name: string,
  options: CustomIconOptions,
  render: (props: CustomIconRenderProps) => React.ReactNode
): AppIconComponent {
  const { viewBox, fill = 'none', strokeLinecap = 'round', strokeLinejoin = 'round' } = options;
  const canvasWidth = Number.parseFloat(viewBox.split(/[\s,]+/)[2] ?? '');
  const strokeScale = options.strokeScale ?? (Number.isFinite(canvasWidth) ? canvasWidth / ICON_PARK_CANVAS_WIDTH : 1);

  const CustomIcon: React.FC<AppIconComponentProps> = (props) => {
    const {
      size = 16,
      strokeWidth = 3,
      fill: fillProp = 'currentColor',
      className,
      onClick,
      // icon-park 的多色主题参数 —— 定制图标只做单色,这里显式丢弃。
      // 不丢的话它们会被当作未知 DOM 属性透传到 <span>,React 会打警告。
      theme: _theme,
      spin: _spin,
      strokeLinecap: _linecap,
      strokeLinejoin: _linejoin,
      ...rest
    } = props;

    // icon-park 的 fill 允许数组(多色主题),取第一个当主色 —— 与它的 IconConverter 一致。
    const color = Array.isArray(fillProp) ? (fillProp[0] ?? 'currentColor') : fillProp;
    const scaledStrokeWidth = strokeWidth * strokeScale;

    return (
      <span className={cx('i-icon', `i-icon-${name}`, className)} onClick={onClick} {...rest}>
        <svg
          width={size}
          height={size}
          viewBox={viewBox}
          fill={fill}
          stroke={color}
          strokeWidth={scaledStrokeWidth}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          // 让路径上的 `currentColor` 解析成我们的描边色 —— 设计稿导出的 SVG
          // 普遍带 `stroke="currentColor"`,保留它就不用改颜色。
          style={{ color }}
        >
          {render({ size, fill: color, strokeWidth: scaledStrokeWidth })}
        </svg>
      </span>
    );
  };

  CustomIcon.displayName = `CustomIcon(${name})`;
  return CustomIcon;
}

// —— 定制图标本体 ——
//
// 模板:
//
//   export const 我的图标 = createCustomIcon('my-icon', { viewBox: '0 0 24 24' }, ({ fill }) => (
//     <path d="M4 12h16" fill={fill} />
//   ));
//
// 注意 `d` 之外的描边属性(`stroke` / `stroke-width` / `stroke-linecap` / `stroke-linejoin`)
// **不要写** —— 它们由 `createCustomIcon` 统一提供,写死了 `AppIcon` 的参数就管不到。
