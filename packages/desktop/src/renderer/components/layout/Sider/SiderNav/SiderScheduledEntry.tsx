/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { AlarmClock } from '@icon-park/react';
import classNames from 'classnames';
import CollapsedRailTooltip from '../CollapsedRailTooltip';

interface SiderScheduledEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderScheduledEntry: React.FC<SiderScheduledEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <CollapsedRailTooltip label={t('cron.scheduledTasks')} onClick={onClick} active={isActive}>
        <AlarmClock
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
    <Tooltip content={t('cron.scheduledTasks')} position='right'>
      <div
        className={classNames(
          'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
          isMobile && 'sider-action-btn-mobile',
          isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
      >
        <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>
          <AlarmClock
            theme='outline'
            size='16'
            fill='currentColor'
            className='block leading-none'
            style={{ lineHeight: 0 }}
          />
        </span>
        <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px'>
          {t('cron.scheduledTasks')}
        </span>
      </div>
    </Tooltip>
  );
};

export default SiderScheduledEntry;
