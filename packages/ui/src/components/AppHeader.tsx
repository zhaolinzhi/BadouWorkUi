/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 顶部条。
 *
 * notes 的 `NotesToolbar`、knowledge-base 的编辑页顶部条,骨架是一样的:
 * 左侧返回 / 中间标题 / 右侧操作。差别只在按钮和文案。共享层只管骨架,
 * 内容一律由调用方通过插槽传进来。
 *
 * 设计约束
 * ========
 * 1. **插槽式布局** —— `leading`(返回)、标题、副标题、`trailing`(操作)各占其位。
 *    组件自己不认识「返回」是什么,它只提供位置。
 * 2. **零内置文案**,标题与副标题都由调用方传入。
 * 3. **只用语义 token**。微应用与 shell 在同一个 document,CSS 变量天然继承。
 * 4. **边框必须显式 `border-solid`**。shell 的 preflight 会给所有元素兜底
 *    `border-style: solid`,但微应用独立运行时没有 preflight —— 不写的话分隔线
 *    在 shell 里可见、在独立运行时不可见,两处观感不一致。
 * 5. **颜色类名走 token**:`bg-1`(面板底色)、`border-b-b-base`(`--border-base`)。
 *    注意别写成 `bg-bg-0` / `border-border-2` —— 那两个名字不生成任何 CSS。
 */
import React from 'react';

import { cx } from '../utils/cx';

export type AppHeaderProps = {
  /** 主标题。 */
  title?: React.ReactNode;
  /** 副标题(计数、状态说明等)。 */
  subtitle?: React.ReactNode;
  /** 左侧插槽,通常是返回按钮。 */
  leading?: React.ReactNode;
  /** 右侧插槽,通常是操作按钮组。 */
  trailing?: React.ReactNode;
  /** 尾部插槽,排在 `trailing` 之后。 */
  children?: React.ReactNode;
  /** 是否吸顶。默认 true。 */
  sticky?: boolean;
  /** 附加 className。 */
  className?: string;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  children,
  sticky = true,
  className,
}) => {
  return (
    <div
      data-testid='app-header'
      className={cx(
        'flex min-h-48px flex-shrink-0 items-center gap-12px border-b border-solid border-b-b-base bg-1 px-18px py-10px',
        sticky && 'sticky top-0 z-10',
        className
      )}
    >
      {leading ? <div className='flex flex-shrink-0 items-center gap-8px'>{leading}</div> : null}

      <div className='min-w-0 flex-1'>
        {title ? (
          <div data-testid='app-header-title' className='truncate text-14px font-600 text-t-primary'>
            {title}
          </div>
        ) : null}
        {subtitle ? (
          <div data-testid='app-header-subtitle' className='truncate text-12px text-t-secondary'>
            {subtitle}
          </div>
        ) : null}
      </div>

      {trailing ? <div className='flex flex-shrink-0 items-center gap-8px'>{trailing}</div> : null}
      {children}
    </div>
  );
};

AppHeader.displayName = 'AppHeader';

export default AppHeader;
