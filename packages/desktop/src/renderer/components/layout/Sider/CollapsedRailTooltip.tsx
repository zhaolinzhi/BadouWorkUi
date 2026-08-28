/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import classNames from 'classnames';

interface CollapsedRailTooltipProps {
  label: string;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  active?: boolean;
  className?: string;
  children: React.ReactElement;
}

/**
 * Hover tooltip for the 48px collapsed sider icon rail. Replaces Arco Tooltip
 * because Arco internally calls React.findDOMNode, which is a no-op under
 * React 18 StrictMode and silently fails to mount its popup.
 *
 * The popup is positioned in viewport coordinates measured from the trigger
 * element on hover; mouseEnter/Leave drive visibility, with no DOM lookup.
 */
const CollapsedRailTooltip: React.FC<CollapsedRailTooltipProps> = ({
  label,
  onClick,
  onContextMenu,
  active,
  className,
  children,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 4 });
  };
  const handleMouseLeave = () => setPosition(null);

  return (
    <div
      ref={wrapperRef}
      className={classNames('relative w-full', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={classNames(
          'w-full h-34px flex items-center justify-center cursor-pointer transition-colors rd-8px text-t-primary',
          active ? 'bg-fill-3' : 'hover:bg-fill-3 active:bg-fill-4'
        )}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        {children}
      </div>
      {position && (
        <div
          role='tooltip'
          className='pointer-events-none fixed z-1000 px-8px py-4px rd-6px text-12px font-[500] whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.16)]'
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

export default CollapsedRailTooltip;