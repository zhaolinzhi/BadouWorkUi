/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Menu } from '@arco-design/web-react';
import { ArrowCircleLeft, Check } from '@icon-park/react';
import { AppIcon } from '@aionui/ui';
import classNames from 'classnames';
import styles from './Sider.module.css';
import CollapsedRailTooltip from './CollapsedRailTooltip';

interface SiderFooterProps {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  theme: string;
  /** 当前登录用户名 —— 没有登录态时退回到品牌名。 */
  userName?: string;
  onSettingsClick: () => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  showLogout?: boolean;
  onLogoutClick?: () => void;
}

/**
 * 侧栏底部账号区 —— 设计稿的 `.account-anchor`。
 *
 * 展开态：头像 + 用户名 + 右箭头(打开个人菜单)+ 右侧独立的设置齿轮。
 * 收缩态：只剩一个 28px 的圆形头像,点开就是个人菜单。
 *
 * 收缩态把齿轮藏起来是设计稿的取舍(`responsive.css` 里 `.sidebar-settings`
 * 在窄屏下 `display:none`),所以「设置 / 外观 / 退出登录」必须能在个人菜单里
 * 找到 —— 否则收缩态下这些入口就彻底没了。
 */
const SiderFooter: React.FC<SiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  theme,
  userName,
  onSettingsClick,
  onThemeChange,
  showLogout = false,
  onLogoutClick,
}) => {
  const { t } = useTranslation();

  const displayName = userName?.trim() || 'BadouWork';
  const initial = displayName.slice(0, 1).toUpperCase();
  const isDark = theme === 'dark';

  const avatar = (size: 28 | 32) => (
    <span
      className={classNames(
        'shrink-0 rd-full flex items-center justify-center bg-[var(--sider-account-avatar-bg)] text-white font-[500]',
        size === 28 ? 'size-28px text-12px' : 'size-32px text-14px'
      )}
    >
      {initial}
    </span>
  );

  const menu = (
    <Menu
      onClickMenuItem={(key) => {
        if (key === 'settings') {
          onSettingsClick();
        } else if (key === 'theme-light') {
          onThemeChange('light');
        } else if (key === 'theme-dark') {
          onThemeChange('dark');
        } else if (key === 'logout') {
          onLogoutClick?.();
        }
      }}
    >
      <Menu.Item key='settings'>
        <span data-testid='sider-account-settings' className='flex items-center'>
          <AppIcon name='sider-settings' size={16} className='mr-6px' />
          {t('common.settings')}
        </span>
      </Menu.Item>
      {/* 外观 —— 设计稿里是一个二级菜单,这里用分组标题把「浅色 / 深色」平铺出来,
          少一层悬停展开,点按路径更短。 */}
      <Menu.ItemGroup
        title={
          <>
            <AppIcon name='account-appearance' size={16} className='mr-6px' />
            {t('sider.account.appearance')}
          </>
        }
      >
        <Menu.Item key='theme-light'>
          <span data-testid='sider-account-theme-light' className='w-full flex items-center'>
            <AppIcon name='account-light' size={16} className='mr-6px' />
            {t('settings.lightMode')}
            {isDark ? null : <Check theme='outline' size={16} className='ml-auto' />}
          </span>
        </Menu.Item>
        <Menu.Item key='theme-dark'>
          <span data-testid='sider-account-theme-dark' className='w-full flex items-center'>
            <AppIcon name='account-dark' size={16} className='mr-6px' />
            {t('settings.darkMode')}
            {isDark ? <Check theme='outline' size={16} className='ml-auto' /> : null}
          </span>
        </Menu.Item>
      </Menu.ItemGroup>
      {showLogout && onLogoutClick && (
        <Menu.Item key='logout'>
          <span data-testid='sider-account-logout' className='flex items-center'>
            <AppIcon name='account-logout' size={16} className='mr-6px text-danger' />
            {t('settings.googleLogout')}
          </span>
        </Menu.Item>
      )}
    </Menu>
  );

  const accountTrigger = (content: React.ReactNode, extraClassName?: string) => (
    <Dropdown droplist={menu} trigger='click' position='br'>
      <div
        role='button'
        tabIndex={0}
        data-testid='sider-account-trigger'
        aria-label={t('sider.account.openMenu')}
        aria-haspopup='menu'
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            (event.currentTarget as HTMLElement).click();
          }
        }}
        className={classNames('cursor-pointer select-none', extraClassName)}
      >
        {content}
      </div>
    </Dropdown>
  );

  // 收缩态 —— 设计稿只留一个圆形头像,居中放在侧栏底部。
  if (collapsed) {
    return (
      <div className='shrink-0 sider-footer mt-auto w-full flex justify-center pt-4px pb-16px'>
        <CollapsedRailTooltip label={displayName}>
          {accountTrigger(
            <div className='rd-full flex items-center justify-center' aria-label={t('sider.account.menuLabel')}>
              {avatar(28)}
            </div>
          )}
        </CollapsedRailTooltip>
      </div>
    );
  }

  // 展开态 —— 账号按钮(头像 + 名字 + 右箭头)+ 右侧的设置齿轮。
  // 左右留白由外层 `layout-sider-content` 的 px-8px 提供,这里补上设计稿
  // `.account-anchor` 剩下的右边距(18px)与上下内边距。
  return (
    <div
      className={classNames(
        'shrink-0 sider-footer mt-auto h-65px box-border flex items-center justify-between gap-40px pt-13px pr-10px pb-10px pl-0',
        styles.accountAnchor
      )}
    >
      {accountTrigger(
        <div
          className={classNames(
            'min-w-0 flex-1 flex items-center gap-8px px-4px py-4px rd-8px transition-colors',
            styles.accountButton
          )}
        >
          {avatar(32)}
          <span className='flex-1 min-w-0 truncate text-14px leading-20px text-t-primary'>{displayName}</span>
          <AppIcon name='sider-chevron-right' size={12} className='shrink-0 text-t-secondary' />
        </div>
      )}
      {/* 设置 / 返回 —— 设置页里变成「返回」。 */}
      <div
        role='button'
        tabIndex={0}
        onClick={onSettingsClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSettingsClick();
          }
        }}
        data-testid='sider-settings-trigger'
        aria-label={isSettings ? t('common.back') : t('common.settings')}
        title={isSettings ? t('common.back') : t('common.settings')}
        className={classNames(
          'w-18px h-18px shrink-0 flex items-center justify-center rd-4px text-t-secondary cursor-pointer transition-colors hover:bg-fill-3 hover:text-t-primary',
          isMobile && 'sider-footer-btn-mobile'
        )}
      >
        {isSettings ? (
          <ArrowCircleLeft theme='outline' size={18} fill='currentColor' className='block leading-none' />
        ) : (
          <AppIcon name='sider-settings' size={18} />
        )}
      </div>
    </div>
  );
};

export default SiderFooter;
