/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `AsyncBoundary` 的行为测试。
 *
 * 它收拢四个微应用各写一遍的三态渲染 —— KB 的 `PersonalKnowledgeBaseList` 与
 * `SharedKnowledgeBaseGrid` 里那两段几乎逐字相同的 class 串就是典型。
 *
 * 关键约束:
 *   - **状态优先级固定**:loading > error > empty > content。
 *     同时命中多个状态时(如请求失败且结果为空)必须渲染最先的那个,
 *     否则会出现"上面显示报错、下面显示空列表"的叠层。
 *   - **任一非 content 状态都不渲染 children** —— 旧内容不该在错误提示下面露出来。
 *   - **没有 onRetry 就不渲染重试按钮** —— 出现一个点了没反应的按钮比没有更糟。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import AsyncBoundary from '../AsyncBoundary';

describe('AsyncBoundary', () => {
  it('loading 时渲染加载态,不渲染 children', () => {
    render(
      <AsyncBoundary loading>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('无异常时渲染 children', () => {
    render(
      <AsyncBoundary>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('content')).toBeTruthy();
    expect(screen.queryByTestId('async-boundary-loading')).toBeNull();
    expect(screen.queryByTestId('async-boundary-error')).toBeNull();
    expect(screen.queryByTestId('async-boundary-empty')).toBeNull();
  });

  it('有 error 时渲染错误态,不渲染 children', () => {
    render(
      <AsyncBoundary error='加载失败'>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('async-boundary-error')).toBeTruthy();
    expect(screen.getByText('加载失败')).toBeTruthy();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('error 是 Error 对象时取它的 message', () => {
    render(<AsyncBoundary error={new Error('网络断了')} />);

    expect(screen.getByText('网络断了')).toBeTruthy();
  });

  it('isEmpty 时渲染空态,不渲染 children', () => {
    render(
      <AsyncBoundary isEmpty>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('async-boundary-empty')).toBeTruthy();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('loading 优先于 error 与 empty', () => {
    render(
      <AsyncBoundary loading error='加载失败' isEmpty>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
    expect(screen.queryByTestId('async-boundary-error')).toBeNull();
    expect(screen.queryByTestId('async-boundary-empty')).toBeNull();
  });

  it('error 优先于 empty', () => {
    render(
      <AsyncBoundary error='加载失败' isEmpty>
        <div data-testid='content'>内容</div>
      </AsyncBoundary>
    );

    expect(screen.getByTestId('async-boundary-error')).toBeTruthy();
    expect(screen.queryByTestId('async-boundary-empty')).toBeNull();
  });

  it('传了 onRetry 就渲染重试按钮', () => {
    render(<AsyncBoundary error='加载失败' onRetry={() => {}} retryText='重试' />);

    expect(screen.getByTestId('async-boundary-retry')).toBeTruthy();
  });

  it('没传 onRetry 就不渲染重试按钮', () => {
    render(<AsyncBoundary error='加载失败' retryText='重试' />);

    expect(screen.queryByTestId('async-boundary-retry')).toBeNull();
  });

  it('没传 retryText 就不渲染重试按钮', () => {
    // 没有文案的重试按钮是个没字的黑方块 —— 与其渲染一个说不清干什么的按钮,不如不渲染
    render(<AsyncBoundary error='加载失败' onRetry={() => {}} />);

    expect(screen.queryByTestId('async-boundary-retry')).toBeNull();
  });

  it('点击重试按钮触发 onRetry', () => {
    const onRetry = vi.fn();
    render(<AsyncBoundary error='加载失败' onRetry={onRetry} retryText='重试' />);

    fireEvent.click(screen.getByTestId('async-boundary-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('渲染传入的 loadingContent', () => {
    render(<AsyncBoundary loading loadingContent='正在加载共享知识库…' />);

    expect(screen.getByText('正在加载共享知识库…')).toBeTruthy();
  });

  it('没传 loadingContent 时渲染纯视觉的 spinner', () => {
    // 共享包不带任何面向用户的文案 —— 文案由调用方用 t(key, { defaultValue }) 传入。
    // 没有文案时只留一个转圈指示,不留空白。
    render(<AsyncBoundary loading />);

    expect(screen.getByTestId('async-boundary-spinner')).toBeTruthy();
  });

  it('渲染传入的 emptyContent', () => {
    render(<AsyncBoundary isEmpty emptyContent={<div data-testid='custom-empty'>自定义空态</div>} />);

    expect(screen.getByTestId('custom-empty')).toBeTruthy();
  });

  it('没传 emptyContent 时渲染默认空状态容器', () => {
    render(<AsyncBoundary isEmpty />);

    expect(screen.getByTestId('async-boundary-empty')).toBeTruthy();
  });
});
