/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 统一图标渲染。
 *
 * 解决主应用与微应用之间最刺眼的一处不一致:主应用的 icon-park 图标被构建期
 * `iconParkPlugin` 自动套 `IconParkHOC`(size=16 / strokeWidth=3 / fill=固定色),
 * 三个微应用没装这个 plugin,图标是裸的 —— 描边更粗、颜色跟随文字色、尺寸五花八门。
 *
 * 设计约束
 * ========
 * 1. **语义名 + 组件透传双通道**。`name` 走内置映射表(产品内统一),
 *    `icon` 直接透传任意 icon-park 组件(映射表没收录的图标)。两者都给时 `icon` 优先。
 * 2. **默认值统一但可覆盖**:size 默认 16、fill 默认 `currentColor`(跟随文字色与主题)、
 *    strokeWidth 默认 3。
 * 3. **cursor-pointer 只在 `interactive` 时加**。主应用的 `IconParkHOC` 给所有图标
 *    强加手型光标,连 `<FileText size={14} />` 这种纯装饰图标也会变手型 ——
 *    这个缺陷不在共享层复现。
 * 4. **未知 name / 空 props 渲染 null,不抛错**。一个图标不该让整页崩掉。
 */
import React from 'react';

import { cx } from '../utils/cx';
import { ICON_MAP, type AppIconComponent, type AppIconName } from './icons';

export type AppIconProps = {
  /** 语义名。走内置映射表。 */
  name?: AppIconName;
  /** 直接透传的 icon-park 组件(或自定义图标组件)。优先级高于 `name`。 */
  icon?: AppIconComponent;
  /** 图标尺寸(px)。默认 16。 */
  size?: number;
  /** 填充色。默认 `currentColor` —— 跟随文字色与明暗主题。 */
  fill?: string;
  /** 描边宽度。默认 3。 */
  strokeWidth?: number;
  /** 附加 className。 */
  className?: string;
  /** 是否可点击。为 true 时才加 `cursor-pointer`。 */
  interactive?: boolean;
  /**
   * 点击回调。透传给图标组件的根元素 —— icon-park 会把多余 props 放到外层
   * `<span>` 上,所以事件能正常触发。
   *
   * 传了 `onClick` 就该同时开 `interactive`,否则光标不会变成手型,用户不知道
   * 这里能点。
   */
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
};

const AppIcon: React.FC<AppIconProps> = ({
  name,
  icon,
  size = 16,
  fill = 'currentColor',
  strokeWidth = 3,
  className,
  interactive = false,
  onClick,
}) => {
  const Component = icon ?? (name ? ICON_MAP[name] : undefined);
  if (!Component) return null;

  return (
    <Component
      theme='outline'
      size={size}
      fill={fill}
      strokeWidth={strokeWidth}
      className={cx(interactive && 'cursor-pointer', className)}
      onClick={onClick}
    />
  );
};

AppIcon.displayName = 'AppIcon';

export type { AppIconComponent, AppIconComponentProps, AppIconName } from './icons';

export default AppIcon;
