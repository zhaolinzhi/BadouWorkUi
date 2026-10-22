// uno.config.ts
import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import {
  sharedPresets,
  sharedRules,
  sharedShortcuts,
  sharedTheme,
} from './packages/desktop/src/renderer/styles/uno-tokens';

/**
 * 语义 token(颜色 / 自定义 rules / shortcuts / theme)定义在
 * `packages/desktop/src/renderer/styles/uno-tokens.ts`,与 qiankun 微应用共享。
 *
 * 共享的前提:所有颜色规则都指向 CSS 变量,而变量由 shell 的主题样式定义在
 * 真实 document 上 —— 微应用的 DOM 在同一 document,变量天然继承。
 * 详见该文件顶部注释。
 *
 * 本文件只保留 shell 独有的一部分:content pipeline、preflights。
 */
export default defineConfig({
  presets: sharedPresets(),
  transformers: [transformerVariantGroup(), transformerDirectives({ enforce: 'pre' })],
  content: {
    pipeline: {
      // Use RegExp instead of glob strings so patterns match against absolute
      // module IDs regardless of the Vite root directory.  electron-vite sets
      // the renderer root to packages/desktop/src/renderer/, which causes glob patterns like
      // 'packages/desktop/src/**/*.tsx' to resolve to the wrong nested path.
      include: [/\.[jt]sx?($|\?)/, /\.vue($|\?)/, /\.css($|\?)/],
      exclude: [/[\\/]node_modules[\\/]/, /\.html($|\?)/],
    },
  },
  rules: sharedRules(),
  // Preflights - Global base styles 全局基础样式
  preflights: [
    {
      getCSS: () => `
        * {
          /* Set default text color to follow theme 所有元素默认使用主题文字颜色 */
          color: inherit;
        }
        /*
         * 边框基线（对齐 Tailwind Preflight）：所有元素默认 border-width:0 + border-style:solid
         * + border-color:transparent。
         *
         * 两个问题一起治：
         * 1) 幽灵框：UnoCSS 的 \`border-solid\` 把四边都设 solid，而单边工具类（border-l/border-b…）
         *    只设自己那条边的宽度，其余三边回退到 CSS 初始 medium(≈1.5px) 并因 solid 显形，画出整框。
         *    宽度基线归零后，单边类只画它自己那条线。
         * 2) 黑边：很多元素只写了 \`border\`/\`border-b\` 却没写颜色类（或写了无效的颜色类），其
         *    border-color 回退到 CSS 初始值 \`currentColor\`（=文字色=深）。以前 border-style 初始为
         *    none 不显形；一旦全局设 solid 就全变黑线。把颜色基线设为 transparent：没显式指定颜色的
         *    边框保持不可见（与改动前一致），显式 border-base 等仍正常显示。
         */
        *,
        ::before,
        ::after {
          border-width: 0;
          border-style: solid;
          border-color: transparent;
        }
        @keyframes wiggle {
          0%, 20%, 100% { transform: rotate(0deg); }
          4% { transform: rotate(8deg); }
          8% { transform: rotate(-8deg); }
          12% { transform: rotate(6deg); }
          16% { transform: rotate(-4deg); }
        }
      `,
    },
  ],
  shortcuts: sharedShortcuts,
  theme: sharedTheme,
});
