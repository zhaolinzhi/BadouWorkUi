/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「更多」菜单。
 *
 * notes 的 `NoteItem` / `NotebookItem` 与 knowledge-base 的 `KnowledgeBaseRow`
 * 各写了一份「⋮ → Arco Dropdown → Menu」的组合,连触发按钮的 class 都一样。
 * 共享层把它们收成一个:统一图标、统一菜单结构、统一回调方式。
 *
 * 设计约束
 * ========
 * 1. **弹层挂到 `document.body`**。qiankun 微应用的容器有 `overflow` 与层叠上下文,
 *    弹层留在容器里会被裁掉 —— 这是微应用里最常见的「菜单点开了却看不见」。
 * 2. **菜单项用 key 回调**。不让调用方在 `onClick` 里比对文案 —— 文案会变、
 *    会走 i18n,比对文案必然漏。
 * 3. **触发按钮是 Arco `Button`**,不是裸 `<button>`。
 */
import { Button, Dropdown, Menu } from '@arco-design/web-react';
import React from 'react';

import { cx } from '../utils/cx';
import AppIcon from './AppIcon';

export type MoreMenuItem = {
  /** 菜单项标识,`onSelect` 回调时原样返回。 */
  key: string;
  /** 菜单项文案。 */
  label: React.ReactNode;
  /** 菜单项图标。 */
  icon?: React.ReactNode;
  /** 危险项(删除等)—— 文字转危险色。 */
  danger?: boolean;
  /** 禁用。禁用的项不会触发 `onSelect`。 */
  disabled?: boolean;
  /** 落到菜单项上的 `data-testid`。列表里每一项都要能被定位时用它。 */
  testId?: string;
};

export type MoreMenuProps = {
  /** 菜单项。 */
  items: MoreMenuItem[];
  /** 选中某项。回调参数是该项的 `key`。 */
  onSelect: (key: string) => void;
  /**
   * 触发按钮的点击回调。
   *
   * 列表行里通常要靠它 `event.stopPropagation()` —— 否则点「更多」会连带触发
   * 整行的点击(选中该行)。Arco 的 Dropdown 会先调子元素的 onClick 再开弹层,
   * 所以阻止冒泡不会影响菜单弹出。
   */
  onClick?: (e: Event) => void;
  /** 触发按钮的无障碍名称(必填)。 */
  label: string;
  /** 触发按钮图标。默认是 `more-one`。 */
  icon?: React.ReactNode;
  /** 禁用整个菜单。 */
  disabled?: boolean;
  /** 触发按钮尺寸。 */
  size?: 'mini' | 'small' | 'default' | 'large';
  /** 附加 className。 */
  className?: string;
  /** 落到触发按钮上的 `data-testid`。 */
  'data-testid'?: string;
};

const MoreMenu: React.FC<MoreMenuProps> = ({
  items,
  onSelect,
  onClick,
  label,
  icon,
  disabled = false,
  size = 'small',
  className,
  'data-testid': dataTestId,
}) => {
  const droplist = (
    <Menu onClickMenuItem={(key) => onSelect(key)}>
      {items.map((item) => (
        <Menu.Item key={item.key} disabled={item.disabled}>
          <span
            data-testid={item.testId}
            className={cx('inline-flex items-center gap-6px', item.danger && 'text-[rgb(var(--danger-6))]')}
          >
            {item.icon}
            {item.label}
          </span>
        </Menu.Item>
      ))}
    </Menu>
  );

  return (
    <Dropdown droplist={droplist} trigger='click' position='br' getPopupContainer={() => document.body}>
      <Button
        type='text'
        size={size}
        icon={icon ?? <AppIcon name='more-one' />}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        data-testid={dataTestId}
        className={cx('!rounded-8px !p-0 !text-t-tertiary hover:!bg-fill-2 hover:!text-t-primary', className)}
      />
    </Dropdown>
  );
};

MoreMenu.displayName = 'MoreMenu';

export default MoreMenu;
