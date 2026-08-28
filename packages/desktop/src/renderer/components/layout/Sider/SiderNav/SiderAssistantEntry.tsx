/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ghost } from '@icon-park/react';
import classNames from 'classnames';

interface SiderAssistantEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

// Pure-CSS hover tooltip for the 48px collapsed icon rail. Replaces the Arco
// Tooltip path because Arco internally calls findDOMNode which is a no-op under
// React 18 StrictMode (see runtimePatches warning) and silently fails to mount
// its popup. This component measures the trigger element on hover and renders
// a fixed-position label adjacent to it, with zero dependencies on Arco's
// tooltip internals.
const CollapsedRailTooltip: React.FC<{ label: string; children: React.ReactElement; onClick?: () => void; active?: boolean }> = ({
  label,
  children,
  onClick,
  active,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    // Position tooltip 4px to the right of the 48px rail, vertically centered.
    setPosition({ top: r.top + r.height / 2, left: r.right + 4 });
  };
  const handleMouseLeave = () => setPosition(null);

  return (
    <div
      ref={wrapperRef}
      className='relative w-full'
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={classNames(
          'w-full h-34px flex items-center justify-center cursor-pointer transition-colors rd-8px text-t-primary',
          active ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
      >
        {children}
      </div>
      {position && (
        <div
          role='tooltip'
          className='sider-rail-tooltip pointer-events-none fixed z-1000 px-8px py-4px rd-6px text-12px font-[500] whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.16)]'
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateY(-50%)',
            background: 'var(--color-tooltip-bg)',
            color: '#fff',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

const SiderAssistantEntry: React.FC<SiderAssistantEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();

  if (collapsed) {
    return (
      <CollapsedRailTooltip label={t('settings.assistants')} onClick={onClick} active={isActive}>
        <Ghost
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
    <div
      className={classNames(
        'box-border group h-34px w-full flex items-center justify-start gap-8px pl-10px pr-8px rd-0.5rem cursor-pointer shrink-0 transition-all text-t-primary',
        isMobile && 'sider-action-btn-mobile',
        isActive ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
      )}
      onClick={onClick}
    >
      <span className='size-22px flex items-center justify-center shrink-0 text-t-primary'>
        <Ghost theme='outline' size='16' fill='currentColor' className='block leading-none' style={{ lineHeight: 0 }} />
      </span>
      <span className='collapsed-hidden text-t-primary text-14px font-[500] leading-24px'>{t('settings.assistants')}</span>
    </div>
  );
};

export default SiderAssistantEntry;
