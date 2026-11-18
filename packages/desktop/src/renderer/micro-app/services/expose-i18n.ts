/**
 * 把主应用已初始化的 i18next 实例挂到真实 `window` 上,供 qiankun 子应用复用。
 *
 * 为什么需要这一步
 * ===============
 * 子应用里的 `useTranslation()` 来自它自己打包的 `react-i18next`。而 i18next
 * 的实例是**模块级单例** —— 两份 `react-i18next` = 两个独立的 `getI18n()`。
 * shell 的 `i18n.use(initReactI18next).init(...)` 只初始化了 shell 那一份,
 * 子应用那份从未 init,`t(key, { defaultValue })` 会直接吐 defaultValue。
 *
 * 也就是说:如果子应用不显式接管实例,它的界面就永远是英文兜底文案。
 * (notes / meeting-recording 目前之所以能显示中文,是靠 workspace hoisting 让
 *  两个 dev server 恰好解析到同一份模块 —— 那是 bundler 的巧合,不是契约,
 *  改依赖树就会静默失效。)
 *
 * 为什么"复用实例"而不是"微应用自带词条"
 * ====================================
 * 知识库有约 50 个 i18n key(`settings.knowledgeBase*` / `common.*`),
 * 已经存在于 shell 的 `settings.json` / `common.json` × 14 个语言里。
 * 复用实例 = 零翻译工作量,且切换语言时子应用自动跟随 —— 词条和语言状态
 * 都由 shell 单点维护,不存在两份词条漂移的风险。
 *
 * 微应用侧怎么用
 * ==============
 * `packages/microapps/shared/src/qiankun/i18n.ts` 的 `adoptShellI18n()`:
 * 子应用启动时读 `window.i18n` 并 `setI18n()`,之后的 `useTranslation()`
 * 就走 shell 的词条与语言状态。拿不到时(standalone 运行)保持原状,组件里
 * 的 `defaultValue` 兜底仍然生效。
 */
import i18n from '@/renderer/services/i18n';

type I18nCarrier = { i18n?: unknown };

if (typeof window !== 'undefined') {
  const carrier = window as unknown as I18nCarrier;
  // 幂等:模块可能被多次 import(HMR / lazy chunk 重复求值)
  if (!carrier.i18n) {
    carrier.i18n = i18n;
  }
}
