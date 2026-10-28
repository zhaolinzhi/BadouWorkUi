/**
 * meeting-recording 微应用自己的 UnoCSS 配置
 *
 * 为什么 meeting-recording 也要自己装 UnoCSS
 * ==========================================
 * shell 的 UnoCSS 只处理**自己那一个 Vite 实例的模块图**(`content.pipeline` 的
 * include 是"这个模块要不要扫",不是"要扫哪些目录")。meeting-recording 是独立的
 * Vite 应用,它的源码从来不在 shell 的模块图里 —— 所以它用到的工具类**在 shell
 * 托管时同样是没生成的**。
 *
 * 独立运行(`bun dev` 直开 7991)时更彻底:Arco 基础样式、主题 CSS 变量、工具类
 * 三样全缺席,页面就是一堆没上妆的 HTML(而且 Arco 的 `--color-bg-1` 之类的
 * 变量也跟着消失,`RecordingListPage.module.css` 的底色直接失效)。
 *
 * 现状说明:meeting-recording 目前的界面**全部走 CSS Module**(`*.module.css`),
 * 还没有用到工具类,所以 UnoCSS 产物目前接近空文件。这里仍然装上,是为了三个
 * 微应用形态一致,并且以后在 MR 里写 `flex h-full` 这类工具类时能立刻生效,
 * 而不会再出现"写了类名但什么样式都没变"的静默失败。
 *
 * 语义 token 与 shell 共用(`uno-tokens.ts`),CSS 变量由 shell 的主题样式定义在
 * 真实 document 上 —— 微应用 DOM 与 shell 同源时变量天然继承,明暗主题自动跟随;
 * 独立运行时由共享包的 `styles/standalone.css` 把那套变量一起带过来。
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
   * 内联后搬进**真实 document**,一份 `*` 规则会波及 shell 页面。
   */
  shortcuts: sharedShortcuts,
  theme: sharedTheme,
});
