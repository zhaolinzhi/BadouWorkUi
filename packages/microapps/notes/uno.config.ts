/**
 * notes 微应用自己的 UnoCSS 配置
 *
 * 为什么 notes 也要自己装 UnoCSS
 * ==============================
 * shell 的 UnoCSS 只处理**自己那一个 Vite 实例的模块图**(`content.pipeline` 的
 * include 是"这个模块要不要扫",不是"要扫哪些目录")。notes 是独立的 Vite 应用,
 * 它的源码从来不在 shell 的模块图里 —— 所以 notes 的工具类**在 shell 托管时同样
 * 是没生成的**(包括 `NotesPage.tsx` 顶层那个 `flex h-full min-h-0` 的布局骨架)。
 *
 * 独立运行(`bun dev` 直开 7992)时更彻底:Arco 基础样式、主题 CSS 变量、工具类
 * 三样全缺席,页面就是一堆没上妆的 HTML。
 *
 * 三个子应用现在都自装了一套(notes / knowledge-base / meeting-recording),
 * 配置形态一致 —— 共用同一份 token,都不带 preflight。
 *
 * 语义 token 与 shell 共用(`uno-tokens.ts`),CSS 变量由 shell 的主题样式定义在
 * 真实 document 上 —— 微应用 DOM 与 shell 同源时变量天然继承,明暗主题自动跟随;
 * 独立运行时由共享包的 `styles/standalone.css` 把那套变量一起带过来。
 *
 * 与 shell 配置(根 `uno.config.ts`)的差异:
 *   - `content.pipeline.include` 去掉 `.vue`(shell 的历史包袱,这里用不到)
 *   - **不共享 preflights**:见下
 */
import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import { sharedPresets, sharedRules, sharedShortcuts, sharedTheme } from '../../desktop/src/renderer/styles/uno-tokens';

export default defineConfig({
  presets: sharedPresets(),
  transformers: [transformerVariantGroup(), transformerDirectives({ enforce: 'pre' })],
  content: {
    pipeline: {
      // RegExp 而非 glob:glob 会相对 vite root 解析,root 一变就匹配不到。
      include: [/\.[jt]sx?($|\?)/, /\.css($|\?)/],
      exclude: [/[\\/]node_modules[\\/]/, /\.html($|\?)/],
    },
  },
  rules: sharedRules(),
  /**
   * 刻意**不带 preflight**。
   *
   * shell 的 preflight 是 `*` 选择器(`border-width: 0` / `border-style: solid` /
   * `border-color: transparent` 等全局基线)。子应用的 CSS 会被 import-html-entry
   * 内联后搬进**真实 document**,一份 `*` 规则会波及 shell 页面 —— 所以
   * knowledge-base 也刻意没抄 preflight(见其 uno.config.ts 注释)。
   *
   * notes 不受影响:`NotesToolbar` 的 `border-b` 只是「一条线」,shell 侧靠 preflight
   * 的 `border-color: transparent` 让它不可见;独立运行时没有 preflight,线的样式
   * 是初始的 `none`,同样不可见 —— 两边观感一致。
   */
  shortcuts: sharedShortcuts,
  theme: sharedTheme,
});
