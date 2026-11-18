/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 异步数据的四态边界:loading / error / empty / content。
 *
 * 收拢三个微应用各写一遍的三态渲染 —— KB 的 `KnowledgeBaseGrid` 里那两段
 * 几乎逐字相同的 class 串就是典型。
 *
 * 设计约束
 * ========
 * 1. **状态优先级固定**:loading > error > empty > content。
 *    同时命中多个状态时只渲染最先的那个,否则会出现"上面报错、下面空列表"的叠层。
 * 2. **任一非 content 状态都不渲染 children** —— 旧内容不该在错误提示下面露出来。
 * 3. **组件自带零面向用户的文案**。共享包不在 shell 的 i18n 词条体系里,
 *    硬编码英文会违反项目的 i18n 规则;而 `t(key, { defaultValue })` 的兜底
 *    行为又依赖调用方的 i18n 实例。所以文案一律由调用方用
 *    `t(key, { defaultValue })` 算好再传进来。
 * 4. **没有文案就不渲染按钮** —— 一个没字的重试按钮比没有更糟。
 * 5. **`className` 落到状态根容器**。列表里的边界只需要「占一块地方」,
 *    整页的边界要「撑满整页」—— 这两者的差别只能由调用方决定,
 *    所以根容器留一个口子。
 */
import { Button, Spin } from '@arco-design/web-react';
import React from 'react';

import { cx } from '../utils/cx';
import EmptyState from './EmptyState';

export type AsyncBoundaryProps = {
  /** 是否处于加载中。优先级最高。 */
  loading?: boolean;
  /** 错误信息。传 `Error` 对象时自动取 `message`。 */
  error?: React.ReactNode | Error | null;
  /** 结果是否为空。 */
  isEmpty?: boolean;
  /** 重试回调。给了且给了 `retryText` 才渲染重试按钮。 */
  onRetry?: () => void;
  /** 加载态内容。默认渲染一个纯视觉的转圈指示。 */
  loadingContent?: React.ReactNode;
  /** 错误态标题。 */
  errorContent?: React.ReactNode;
  /** 空态内容。默认渲染一个无文案的 `EmptyState`。 */
  emptyContent?: React.ReactNode;
  /** 重试按钮文案。 */
  retryText?: React.ReactNode;
  /** 附加 className,落到状态根容器上。 */
  className?: string;
  /** 正常态内容。 */
  children?: React.ReactNode;
};

const AsyncBoundary: React.FC<AsyncBoundaryProps> = ({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingContent,
  errorContent,
  emptyContent,
  retryText,
  className,
  children,
}) => {
  if (loading) {
    return (
      <div
        data-testid='async-boundary-loading'
        className={cx('flex items-center justify-center px-20px py-28px text-center', className)}
      >
        {loadingContent ?? <Spin size={20} data-testid='async-boundary-spinner' />}
      </div>
    );
  }

  if (error) {
    const detail = error instanceof Error ? error.message : error;
    return (
      <div
        data-testid='async-boundary-error'
        className={cx(
          'flex flex-col items-center rounded-14px border border-dashed border-b-2 bg-fill-1/40 px-20px py-20px text-center',
          className
        )}
      >
        {errorContent ? <div className='mb-6px text-13px font-600 text-t-primary'>{errorContent}</div> : null}
        {detail ? <div className='mb-10px text-12px text-t-tertiary'>{detail}</div> : null}
        {onRetry && retryText ? (
          <Button
            type='primary'
            size='small'
            className='!h-28px !rounded-9px'
            onClick={onRetry}
            data-testid='async-boundary-retry'
          >
            {retryText}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        data-testid='async-boundary-empty'
        className={cx('flex h-full w-full items-center justify-center', className)}
      >
        {emptyContent ?? <EmptyState />}
      </div>
    );
  }

  return <>{children}</>;
};

AsyncBoundary.displayName = 'AsyncBoundary';

export default AsyncBoundary;
