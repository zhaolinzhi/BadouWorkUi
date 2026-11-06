/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 独立运行(dev 直开子应用)时加载 shell 提供的样式
 *
 * 为什么需要
 * =========
 * 子应用的样式有三处来源,被 shell 托管时都由 shell 提供:
 *
 *   1. Arco 基础样式   —— shell 的 `main.tsx` 里 `import '@arco-design/web-react/dist/css/arco.css'`
 *   2. Arco 主题覆盖   —— shell 的 `styles/arco-override.css`
 *   3. 主题 CSS 变量   —— shell 的 `styles/themes/index.css`(`--bg-base` / `--text-primary` …)
 *
 * 独立运行时没有 shell,这三份都不在,于是:Arco 组件退回浏览器默认外观、
 * 语义色变量全是空值、页面连边距都没有。
 *
 * 为什么只在独立运行时加载
 * =======================
 * 这份样式**不能**跟着子应用无条件打包:被 shell 托管时,子应用的 CSS 会被
 * `import-html-entry` 内联后搬到真实 `document.head` 末尾 —— 排在 shell 的
 * `arco-override.css` 之后,等于把 shell 的主题覆盖又盖回去。
 *
 * 所以由各子应用 `main.ts` 的 standalone 分支按需 `import()`(且只在 dev)。
 * 被 shell 托管时这个分支根本不执行,样式仍然只由 shell 提供一份。
 */

/**
 * 加载独立运行所需的样式。
 *
 * 用动态 `import()` 而不是顶层静态 import:
 * - 被 shell 托管时这段代码根本不执行,样式仍然只由 shell 提供一份;
 * - 顶层静态 import 会让这份 CSS 无条件进子应用的产物,并在 qiankun 托管时
 *   被搬进真实 document 末尾,盖掉 shell 的主题覆盖。
 *
 * 样式文件本身在共享包内(相对路径),调用方不需要额外的 alias。
 *
 * 已知代价:即便调用点被 `import.meta.env.DEV` 判掉,Rollup 仍会为这个动态
 * import 产出一个没人加载的 CSS chunk —— 三个子应用的生产产物里各多一个
 * 孤儿 `dist/assets/standalone-*.css`(约 585 kB / gzip 67 kB)。
 */
export async function loadStandaloneStyles(): Promise<void> {
  await import('../styles/standalone.css');
}
