/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 侧栏导航项 —— 展开态与收缩态共用同一套结构。
 *
 * 为什么收敛成一个组件
 * ===================
 * 之前每个入口(助手 / 知识库 / 笔记 / …)都各写一份「收缩态 + 展开态」两份实现,
 * 九个入口就是十八份几乎一样的 JSX —— 改一次样式要改九处,漏一处就会出现
 * 「有的入口是磁贴、有的还是旧行」的割裂感。
 *
 * 设计稿(1920 稿)对两种状态的规定
 * ==============================
 * - **收缩态**:56×56 磁贴,20px 图标在上、12px 文字在下,磁贴之间留 8px;
 * - **展开态**:整行(232×32),18px 图标 + 14px 文字,行内留 8px,行高 32px。
 *
 * 收缩态磁贴已经把文字画在图标下面了,所以**不再需要 hover 浮层提示**
 * (旧实现里的 `CollapsedRailTooltip` 就是为此存在的)。
 */
import React from 'react';
import classNames from 'classnames';
import styles from '../Sider.module.css';

export type SiderNavItemProps = {
  /** 图标节点 —— 由调用方决定用定制图标还是 icon-park 图标。 */
  icon: React.ReactNode;
  /** 收缩态磁贴下方的短标签(如「录音」)。 */
  collapsedLabel: string;
  /** 展开态行内的完整标签(如「会议录音」)。 */
  expandedLabel: string;
  /** 侧栏是否处于收缩态。 */
  collapsed: boolean;
  /** 当前路由是否命中。 */
  isActive?: boolean;
  /** 移动端 —— 沿用既有的大点击区类名。 */
  isMobile?: boolean;
  /** 主入口样式(「新会话」的浅蓝描边磁贴)。 */
  accent?: boolean;
  /** 点击回调。 */
  onClick: () => void;
  /** 行尾附加内容(仅展开态渲染),例如批量管理按钮。 */
  trailing?: React.ReactNode;
  /** 自动化测试用的锚点。 */
  testId?: string;
};

const SiderNavItem: React.FC<SiderNavItemProps> = ({
  icon,
  collapsedLabel,
  expandedLabel,
  collapsed,
  isActive = false,
  isMobile = false,
  accent = false,
  onClick,
  trailing,
  testId,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick();
  };

  if (collapsed) {
    return (
      <div
        role='button'
        tabIndex={0}
        aria-label={expandedLabel}
        data-testid={testId}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={classNames(
          'w-56px h-56px shrink-0 flex flex-col items-center justify-center gap-4px rd-8px cursor-pointer select-none transition-colors',
          accent ? styles.navAccent : isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4',
          isMobile && 'sider-action-btn-mobile'
        )}
      >
        <span className='size-20px flex items-center justify-center shrink-0 text-t-primary'>{icon}</span>
        <span className='max-w-56px truncate text-12px leading-17px text-t-primary'>{collapsedLabel}</span>
      </div>
    );
  }

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={expandedLabel}
      data-testid={testId}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={classNames(
        'box-border group w-full h-32px flex items-center gap-8px px-8px rd-8px cursor-pointer shrink-0 transition-colors',
        accent ? styles.navAccent : isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4',
        isMobile && 'sider-action-btn-mobile'
      )}
    >
      <span className='size-18px flex items-center justify-center shrink-0 text-t-primary'>{icon}</span>
      <span className='flex-1 min-w-0 truncate text-14px leading-20px font-[500] text-t-primary'>{expandedLabel}</span>
      {trailing}
    </div>
  );
};

export default SiderNavItem;
