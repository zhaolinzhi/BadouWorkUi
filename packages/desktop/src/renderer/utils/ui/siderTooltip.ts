import type { TooltipProps } from '@arco-design/web-react';

/**
 * 侧边栏内 Tooltip 的挂载容器：折叠态（48px 宽）popup 必须挂在 body 上，
 * 否则会被 .layout-sider 的内部布局容器或 48px 宽度限制遮挡，导致图标悬停时
 * 看不到 Tooltip。展开态下仍把 popup 挂到 body，与 issue #987 的"关闭侧栏时
 * tooltip 残留"问题不冲突：cleanupSiderTooltips() 在 collapsed 状态变化时
 * 会主动清理已挂的 tooltip 节点。
 * See: https://github.com/iOfficeAI/AionUi/issues/987
 */
export const getSiderPopupContainer = (_node: HTMLElement): Element => document.body;

const isNoHoverDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;
};

const SIDER_TOOLTIP_CLASS = 'sider-tooltip-popup';

export const cleanupSiderTooltips = () => {
  if (typeof document === 'undefined') return;
  // Arco Tooltip occasionally leaves detached popup nodes; remove both scoped and global tooltip popups.
  document.querySelectorAll(`.${SIDER_TOOLTIP_CLASS}, .arco-tooltip-popup`).forEach((node) => node.remove());
};

export type SiderTooltipProps = Pick<
  TooltipProps,
  'className' | 'trigger' | 'disabled' | 'unmountOnExit' | 'popupHoverStay' | 'popupVisible' | 'getPopupContainer'
>;

export const getSiderTooltipProps = (enabled = false): SiderTooltipProps => {
  const disabled = !enabled || isNoHoverDevice();
  return {
    className: SIDER_TOOLTIP_CLASS,
    trigger: disabled ? [] : 'hover',
    disabled,
    unmountOnExit: true,
    popupHoverStay: false,
    popupVisible: disabled ? false : undefined,
    getPopupContainer: getSiderPopupContainer,
  };
};
