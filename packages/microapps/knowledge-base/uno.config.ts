/**
 * 微应用自己的 UnoCSS 配置
 *
 * 之前 notes / meeting-recording 都没装 UnoCSS —— 它们的界面能用纯粹是因为
 * 用到的类名恰好与 shell 重合,被 shell 的 UnoCSS 顺带生成。知识库用的是一套
 * shell 自己不用的 token 组合(`bg-bg-0`、`text-t-tertiary`、`border-b-2`…),
 * 实测 174 个候选 token 在 shell 侧一条都生成不出来。所以必须自装。
 *
 * 语义 token 与 shell 共用(`uno-tokens.ts`),CSS 变量由 shell 主题定义在真实
 * document 上,微应用 DOM 同源 → 变量天然继承,明暗主题自动跟随。
 *
 * 与 shell 配置的差异:
 *   - `content.pipeline.include` 去掉 `.vue`(shell 的历史包袱,这里用不到)
 *   - 不共享 preflights(`*` 选择器会污染 shell 的 document)
 */
import { defineConfig, transformerDirectives, transformerVariantGroup } from 'unocss';
import { sharedPresets, sharedRules, sharedShortcuts, sharedTheme } from '../../desktop/src/renderer/styles/uno-tokens';

export default defineConfig({
  presets: sharedPresets(),
  transformers: [transformerVariantGroup(), transformerDirectives({ enforce: 'pre' })],
  content: {
    pipeline: {
      // RegExp 而非 glob:electron-vite / vite 的 root 各不相同,glob 会解析错。
      include: [/\.[jt]sx?($|\?)/, /\.css($|\?)/],
      exclude: [/[\\/]node_modules[\\/]/, /\.html($|\?)/],
    },
  },
  rules: sharedRules(),
  shortcuts: sharedShortcuts,
  theme: sharedTheme,
});
