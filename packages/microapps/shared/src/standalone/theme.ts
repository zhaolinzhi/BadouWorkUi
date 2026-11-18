/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 独立运行(直接 `vite dev` 打开子应用)时的主题处理
 *
 * 背景
 * ====
 * 明暗主题在 shell 侧由两处承担:
 *   - `styles/themes/index.css` 里的 CSS 变量(`--text-primary` / `--bg-base` …),
 *     按 `html[data-theme]` 切换;
 *   - Arco 自己的暗色样式,按 `body[arco-theme]` 切换
 *     (见 `styles/arco-override.css` 的选择器)。
 *
 * 独立运行时这两处都没有宿主来设置,页面就永远是亮色 —— 深色系统偏好下尤其刺眼。
 * 所以 standalone 分支要把属性写到 document 上。
 *
 * 注意:被 shell 托管时**不要**写这两个属性。shell 的 `<html>` / `<body>` 上已经有
 * 宿主算好的值,子应用再写一遍会盖掉宿主的判断(比如宿主跟随系统、用户又切了别的
 * 主题)。所以只在 standalone 分支调用。
 */

/** standalone 支持的两套外观。 */
export type StandaloneTheme = 'light' | 'dark';

/**
 * shell 缓存「明/暗外观」的 localStorage key。
 * 与 `packages/desktop/src/renderer/hooks/system/useTheme.ts` 的
 * `APPEARANCE_CACHE_KEY` 一致 —— 那里存的就是 `light` / `dark`。
 */
const APPEARANCE_CACHE_KEY = '__aionui_theme';

/**
 * 读出独立运行该用哪套外观。
 *
 * 读不到(没装过 Electron、或隐私模式禁用了 localStorage)时按亮色走 ——
 * 与 shell 的默认主题一致。
 */
export function resolveStandaloneTheme(): StandaloneTheme {
  try {
    return localStorage.getItem(APPEARANCE_CACHE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * 把外观写到 document 上。
 *
 * - `html[data-theme]` + `html[data-color-scheme]` —— 切主题 CSS 变量
 *   (亮色是 `:root, [data-color-scheme='default']`,暗色是
 *   `[data-color-scheme='default'][data-theme='dark']`,两个属性都要)
 * - `body[arco-theme]` —— Arco 组件的暗色样式
 */
export function applyStandaloneTheme(theme: StandaloneTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-color-scheme', 'default');
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('arco-theme', theme);
}
