/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Tooltip } from '@arco-design/web-react';
import { Clipboard } from '@icon-park/react';
import classNames from 'classnames';
import CollapsedRailTooltip from '../CollapsedRailTooltip';
import { useTaskCenterT } from '@renderer/pages/task-center/useTaskCenterT';

interface SiderTaskCenterEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderTaskCenterEntry: React.FC<SiderTaskCenterEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const t = useTaskCenterT();
  const title = String(t('taskCenter.title'));

  if (collapsed) {
    return (
      <CollapsedRailTooltip label={title} onClick={onClick} active={isActive}>
        <Clipboard
          theme='outline'
          size='20'
          fill='currentColor'
          className='block leading-none shrink-0'
          style={{ lineHeight: 0 }}
        />
      </CollapsedRailTooltip>
    );
  }

  return (
    <Tooltip content={title} disabled={!collapsed} position='right'>
      <div
        className={classNames(
          'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
          isMobile && 'sider-action-btn-mobile',
          isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
      >
        <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>
          <Clipboard
            theme='outline'
            size='16'
            fill='currentColor'
            className='block leading-none'
            style={{ lineHeight: 0 }}
          />
        </span>
        <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px'>{title}</span>
      </div>
    </Tooltip>
  );
};

export default SiderTaskCenterEntry;
