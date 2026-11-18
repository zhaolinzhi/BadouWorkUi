/**
 * Ambient type declarations for the shared micro-app package.
 *
 * 共享包里有两处会 import 样式:
 *   - `src/standalone/styles.ts` 动态 import `src/styles/standalone.css`
 *   - 各子应用通过 `@aionui/microapp-shared` 间接用到
 *
 * `tsc --noEmit` 会单独跑这个包,没有 Vite 插件帮忙解析 CSS 模块,
 * 所以这里补一份 `*.css` 的 ambient 声明(与各子应用的 `types.d.ts` 同款)。
 */
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}
