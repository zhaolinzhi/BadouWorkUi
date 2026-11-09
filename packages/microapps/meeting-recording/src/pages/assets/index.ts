/**
 * 录音列表页的静态素材。
 *
 * 为什么用 `?inline`
 * =================
 * 设计稿的插画是一张位图(`00be5.png`,3D 渲染的「文档 + 放大镜」)。
 * 普通 `import` 会被 vite 改写成 `new URL('xxx.png', import.meta.url).href` ——
 * 而生产形态下 qiankun 走 import-html-entry 的 **fetch + eval**,产物里的
 * `import.meta.url` 会按 **shell 的 document base URL** 解析,打进安装包后
 * 这张图必然 404(与 `vite.config.ts` 顶部注释记的是同一类坑)。
 *
 * `?inline` 让 vite 把图片直接以 base64 data URI 内联进产物:不产出独立资源
 * 文件,也不经过任何 URL 解析 —— 开发服务器、standalone 页面与安装包三种形态
 * 都能正常显示。代价是产物里多了约 40KB 的 base64,这个体积换一张插画划算。
 */
import illustration from './recording-no-results.png?inline';

/** 「没有找到相关录音」空结果态的插画。 */
export const recordingNoResultsIllustration: string = illustration;
