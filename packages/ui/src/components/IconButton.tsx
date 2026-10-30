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
  /** 附加 className。 */
  className?: string;
  /** 落到根按钮上的 `data-testid`。 */
  'data-testid'?: string;
};

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  onClick,
  type = 'text',
  size = 'small',
  status,
  disabled = false,
  loading = false,
  className,
  'data-testid': dataTestId,
}) => {
  return (
    <Button
      type={type}
      size={size}
      status={status}
      disabled={disabled}
      loading={loading}
      icon={icon}
      aria-label={label}
      onClick={onClick}
      data-testid={dataTestId}
      className={cx('!rounded-8px', className)}
    />
  );
};

IconButton.displayName = 'IconButton';

export default IconButton;
