/**
 * UnoCSS 语义 token 共享层
 *
 * 抽出这份定义的原因:`uno.config.ts` 里的颜色规则**全部指向 CSS 变量**
 * (`var(--text-primary)`、`var(--bg-1)` …),而变量本身由 shell 的主题样式
 * 定义在真实 window 的 document 上。qiankun 微应用的 DOM 和 shell 在同一个
 * document —— 所以 CSS 变量天然继承,微应用只要拿到**同一份类名 → 变量**的
 * 映射规则,样式就自动跟随 shell 的明暗主题。
 *
 * 谁在用:
 *   - shell:      `uno.config.ts`(根)
 *   - 微应用:     `packages/microapps/<name>/uno.config.ts`,经 vite alias 引用本文件
 *
 * ⚠️ 微应用**不共享 preflights**:preflight 是 `*` 选择器,而微应用的 CSS 注入
 * 到真实 document 上会污染 shell。`border-width: 0` 这条基线 shell 已经注入过,
 * standalone 场景下缺失的影响可接受。需要时在微应用自己的 uno.config 里补。
 */
import { presetExtra } from 'unocss-preset-extra';
import { presetMini, presetWind3 } from 'unocss';

// ==================== 语义化文字颜色 / Semantic Text Colors ====================
const textColors = {
  't-primary': 'var(--text-primary)',
  't-secondary': 'var(--text-secondary)',
  't-tertiary': 'var(--bg-6)',
  't-disabled': 'var(--text-disabled)',
};

// ==================== 语义状态色 / Semantic State Colors ====================
const semanticColors = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

// ==================== 背景色系统 / Background Color System ====================
const backgroundColors = {
  base: 'var(--bg-base)',
  1: 'var(--bg-1)',
  2: 'var(--bg-2)',
  3: 'var(--bg-3)',
  4: 'var(--bg-4)',
  5: 'var(--bg-5)',
  6: 'var(--bg-6)',
  8: 'var(--bg-8)',
  9: 'var(--bg-9)',
  10: 'var(--bg-10)',
  hover: 'var(--bg-hover)',
  active: 'var(--bg-active)',
};

// ==================== 边框颜色 / Border Colors ====================
const borderColors = {
  'b-base': 'var(--border-base)',
  'b-light': 'var(--border-light)',
  'b-1': 'var(--bg-3)',
  'b-2': 'var(--bg-4)',
  'b-3': 'var(--bg-5)',
};

// ==================== 品牌色 / Brand Colors ====================
const brandColors = {
  brand: 'var(--brand)',
  'brand-light': 'var(--brand-light)',
  'brand-hover': 'var(--brand-hover)',
};

// ==================== AOU 品牌色系 / AOU Brand Colors ====================
const aouColors = {
  aou: {
    1: 'var(--aou-1)',
    2: 'var(--aou-2)',
    3: 'var(--aou-3)',
    4: 'var(--aou-4)',
    5: 'var(--aou-5)',
    6: 'var(--aou-6)',
    7: 'var(--aou-7)',
    8: 'var(--aou-8)',
    9: 'var(--aou-9)',
    10: 'var(--aou-10)',
  },
};

// ==================== UI 组件专用颜色 / UI Component Specific Colors ====================
const componentColors = {
  'message-user': 'var(--message-user-bg)',
  'message-tips': 'var(--message-tips-bg)',
  'workspace-btn': 'var(--workspace-btn-bg)',
};

// ==================== 特殊颜色 / Special Colors ====================
const specialColors = {
  fill: 'var(--fill)',
  inverse: 'var(--inverse)',
};

/** 微应用与 shell 共用的 presets。 */
export const sharedPresets = () => [presetMini(), presetExtra(), presetWind3()];

/** 微应用与 shell 共用的自定义 rules。 */
export const sharedRules = () => [
  // Arco Design 官方文字颜色 text-1 到 text-4
  [/^text-([1-4])$/, ([, d]: RegExpExecArray) => ({ color: `var(--color-text-${d})` })],

  // Arco Design 官方填充色 fill-1 到 fill-4
  [/^bg-fill-([1-4])$/, ([, d]: RegExpExecArray) => ({ 'background-color': `var(--color-fill-${d})` })],

  // Arco Design 官方边框色 border-1 到 border-4
  [/^border-arco-([1-4])$/, ([, d]: RegExpExecArray) => ({ 'border-color': `var(--color-border-${d})` })],

  // Arco Design 浅色系 primary/success/warning/danger/link
  [
    /^bg-(primary|success|warning|danger|link)-light-([1-4])$/,
    ([, color, d]: RegExpExecArray) => ({ 'background-color': `var(--color-${color}-light-${d})` }),
  ],

  // Arco Design 官方色阶 1-9
  [
    /^(bg|text|border)-(primary|success|warning|danger)-([1-9])$/,
    ([, prefix, color, d]: RegExpExecArray) => {
      const prop = prefix === 'bg' ? 'background-color' : prefix === 'text' ? 'color' : 'border-color';
      return { [prop]: `rgb(var(--${color}-${d}))` };
    },
  ],

  ['bg-color-white', { 'background-color': 'var(--color-white)' }],
  ['text-color-white', { color: 'var(--color-white)' }],
  ['bg-color-black', { 'background-color': 'var(--color-black)' }],
  ['text-color-black', { color: 'var(--color-black)' }],

  ['bg-popup', { 'background-color': 'var(--color-bg-popup)' }],

  // 项目自定义颜色
  ['bg-dialog-fill-0', { 'background-color': 'var(--dialog-fill-0)' }],
  ['text-0', { color: 'var(--text-0)' }],
  ['text-white', { color: 'var(--text-white)' }],
  ['bg-fill-0', { 'background-color': 'var(--fill-0)' }],
  ['bg-fill-white-to-black', { 'background-color': 'var(--fill-white-to-black)' }],
  ['border-special', { 'border-color': 'var(--border-special)' }],

  ['animate-wiggle', { animation: 'wiggle 3s ease-in-out infinite' }],
];

/** 微应用与 shell 共用的 shortcuts。 */
export const sharedShortcuts = {
  'flex-center': 'flex items-center justify-center',
};

/** 微应用与 shell 共用的 theme。 */
export const sharedTheme = {
  colors: {
    ...textColors,
    ...semanticColors,
    ...backgroundColors,
    ...borderColors,
    ...brandColors,
    ...aouColors,
    ...componentColors,
    ...specialColors,
  },
  fontFamily: {
    mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", monospace',
  },
};
