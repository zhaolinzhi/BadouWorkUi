/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 空状态。
 *
 * 收拢三个微应用各写一份的空状态(notes 自绘版、KB 两处自绘、MR 一行纯文本),
 * 统一成「图标 → 主文案 → 辅助说明 → 操作入口」的竖排结构。
 *
 * 设计约束
 * ========
 * 1. **可选内容缺失时整块不渲染**。空占位会撑出多余高度,视觉上表现为
 *    "文案下面凭空多出一段空白"。每个可选区都带独立 testid,便于断言它不存在。
 * 2. **不带任何 i18n key**。纯展示组件,文案由调用方用
 *    `t(key, { defaultValue })` 传入 —— standalone(dev 直开微应用)下没有
 *    shell 的 i18next 实例,只有调用方自己兜底才靠谱。
 * 3. **只用语义 token**(`text-t-primary` / `text-t-secondary`),
 *    颜色跟着 shell 的明暗主题走 —— 微应用的 DOM 与 shell 在同一 document,
 *    CSS 变量天然继承。
 */
import React from 'react';

import { cx } from '../utils/cx';

export type EmptyStateProps = {
  /** 顶部图标,通常是 `AppIcon` 或 icon-park 组件。 */
  icon?: React.ReactNode;
  /** 主文案。 */
  title?: React.ReactNode;
  /** 辅助说明。省略时整行不渲染。 */
  description?: React.ReactNode;
  /** 底部操作入口。省略时整块不渲染。 */
  action?: React.ReactNode;
  /** 根容器附加 className。 */
  className?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => {
  return (
    <div
      className={cx('flex h-full w-full flex-col items-center justify-center gap-12px text-t-secondary', className)}
      data-testid='empty-state'
    >
      {icon ? (
        <div data-testid='empty-state-icon' className='flex items-center justify-center'>
          {icon}
        </div>
      ) : null}

      {title ? (
        <div data-testid='empty-state-title' className='text-16px font-600 text-t-primary'>
          {title}
        </div>
      ) : null}

      {description ? (
        <div data-testid='empty-state-description' className='text-12px'>
          {description}
        </div>
      ) : null}

      {action ? (
        <div data-testid='empty-state-action' className='mt-4px'>
          {action}
        </div>
      ) : null}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';

export default EmptyState;
