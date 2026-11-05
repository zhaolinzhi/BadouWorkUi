/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 图标按钮。
 *
 * 主应用与三个微应用里到处是「一个图标 + 一个方块」的按钮,尺寸、圆角、
 * hover 底色各写各的,慢慢就长得不一样了。共享层把它收敛成一份尺寸契约。
 *
 * 设计约束
 * ========
 * 1. **`label` 必填**。图标按钮没有文字,`aria-label` 是它唯一的可访问名称 ——
 *    缺了它读屏软件只能念出「按钮」。
 * 2. **不写裸 `<button>`**。底层是 Arco `Button`,禁用态 / 加载态由 Arco 保证
 *    (禁用时不会触发 `onClick`)。
 * 3. **正方形**。Arco 的 icon-only 按钮本来就按 size 给正方形
 *    (mini/small/default/large → 24/28/32/36),所以这里不用自己算宽高,
 *    只统一圆角。
 * 4. **转发 ref**。Arco 的 `Tooltip` / `Popconfirm` 会给直接子节点挂 ref 来定位
 *    浮层,函数组件不转发 ref 会直接抛「Function components cannot be given refs」。
 * 5. **转发交互事件**。Arco 的浮层把自己的 hover / focus 事件注入到子节点上,
 *    不转发这些事件,浮层就永远弹不出来 —— 详见下面的事件属性说明。
 */
import { Button } from '@arco-design/web-react';
import React from 'react';

import { cx } from '../utils/cx';

export type IconButtonProps = {
  /** 图标内容,通常是 `<AppIcon />`。 */
  icon: React.ReactNode;
  /** 无障碍名称(必填)。落到 `aria-label` 上。 */
  label: string;
  /** 点击回调。 */
  onClick?: (e: Event) => void;
  /** 按钮类型。默认 `text` —— 工具栏与列表里的图标按钮都是无底色的。 */
  type?: 'default' | 'primary' | 'secondary' | 'dashed' | 'text' | 'outline';
  /** 尺寸。 */
  size?: 'mini' | 'small' | 'default' | 'large';
  /** 状态色。`danger` 用于删除类操作。 */
  status?: 'warning' | 'danger' | 'success' | 'default';
  /** 禁用。 */
  disabled?: boolean;
  /** 加载中。 */
  loading?: boolean;
  /** 原生 `title` 提示(悬停时显示)。 */
  title?: string;
  /** 附加 className。 */
  className?: string;
  /** 落到根按钮上的 `data-testid`。 */
  'data-testid'?: string;
  /**
   * 透传给底层按钮的交互事件。
   *
   * Arco 的 `Tooltip` / `Popconfirm` 会把自己的 hover / focus / click 事件
   * 克隆到直接子节点上。共享层如果只挑几个已知 props 转发,浮层就收不到事件,
   * 于是「悬停提示」「点击确认」全都不生效 —— 这类问题只在运行时才暴露,
   * 所以这里把常用事件一次性摊开。
   */
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseMove?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  onContextMenu?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** 透传给底层按钮的行内样式。 */
  style?: React.CSSProperties;
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      onClick,
      type = 'text',
      size = 'small',
      status,
      disabled = false,
      loading = false,
      title,
      className,
      'data-testid': dataTestId,
      onMouseEnter,
      onMouseLeave,
      onMouseMove,
      onMouseDown,
      onContextMenu,
      onFocus,
      onBlur,
      onKeyDown,
      style,
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        type={type}
        size={size}
        status={status}
        disabled={disabled}
        loading={loading}
        icon={icon}
        aria-label={label}
        title={title}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={style}
        data-testid={dataTestId}
        className={cx('!rounded-8px', className)}
      />
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * 告诉 Arco「这是个按钮」。
 *
 * Arco 的 `Trigger`(Tooltip / Popconfirm / Dropdown 的底座)在子节点禁用时,
 * 会给它套一层 `<span>` 并把 `pointer-events: none` 挪到内层按钮上 ——
 * 靠这层壳,禁用按钮也能弹出悬停提示。这个判断依据的是子节点类型上的
 * `__BYTE_BUTTON` 标记,共享层不挂上这个标记,禁用态的提示就静默失效。
 *
 * 标记名是 Arco 内部约定的,不能改 —— 所以这里显式豁免下划线检查。
 */
// oxlint-disable-next-line eslint/no-underscore-dangle
(IconButton as unknown as { __BYTE_BUTTON?: boolean }).__BYTE_BUTTON = true;

export default IconButton;
