# 定制图标（SVG 源文件）

放**icon-park 里没有、单独设计**的 SVG —— 页面重新设计时设计给的那些。

这个目录里的文件**不直接进包**。构建期由 `aionuiSvgIconPlugin`（`packages/ui/src/vite/svgIconPlugin.ts`）
把每个 `.svg` 编译成一个普通 React 组件，运行时和 icon-park 图标完全一致。

## 用法

1. 把设计给的 SVG 丢进来，**文件名 = 语义名**（kebab-case），比如 `star-badge.svg`。
2. **不用改任何代码** —— 构建期自动扫描本目录、生成 `../svg.generated.ts`、并登记进 `ICON_MAP`。
3. 补一行 `docs/contributing/ui-components/app-icon.md` 的「图标语义名全表」——
   有守卫测试盯着，忘了会直接报错告诉你缺哪个名字。

之后全产品都能直接写 `<AppIcon name='star-badge' />`。

> **文件名以 `_` 开头的不自动登记**（`_sample-icon.svg`）——
> 留给「只想用这个 SVG、不想进全局映射表」的场景，比如测试样例。
> `_` 只是标记，不是名字的一部分：组件的 class 仍然是 `i-icon-sample-icon`。

## 转换做了什么

| 设计稿里的东西                                                   | 编译后的行为                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `stroke` / `stroke-width` / `stroke-linecap` / `stroke-linejoin` | **删掉** —— 由外层 `<svg>` 统一给，`AppIcon` 的 `size` / `fill` / `strokeWidth` 才是真的生效 |
| `viewBox`                                                        | 原样保留 —— 改了形状会变形                                                                   |
| 写死的颜色（`fill="#86909C"`）                                   | 保留，但**不跟随主题**，构建时会打印提示                                                     |
| `clip-path` / `fill-rule` 这类属性名                             | 转成 React 的驼峰写法（`clipPath` / `fillRule`）                                             |
| `id`                                                             | 加图标名前缀 —— 避免两个图标的同名 `id` 在同一页撞车                                         |

描边粗细按**设计稿自己的比例**换算（`strokeWidth={3}` 复现设计稿的粗细）。
24 画布 + 1.5 描边（6.25%）与 icon-park 恰好同比例，两套图标看起来一样粗。

## 自动登记是怎么做到的

插件在 dev server / 构建启动时扫本目录，生成 `../svg.generated.ts`：

```ts
import StarBadgeIcon from './svg/star-badge.svg?component';

export const CUSTOM_ICON_MAP = {
  'star-badge': StarBadgeIcon,
} as const;
```

`../index.ts` 把这张表合并进 `ICON_MAP`。

> **为什么生成文件，而不是 `import.meta.glob` 自动注册**：
> `import.meta.glob` 的返回类型是 `Record<string, T>` —— key 是 `string` 而不是字面量，
> `AppIconName` 会从字面量联合塌成 `string`，`<AppIcon name='plsu' />` 编译期就不再报错。
> 生成成真实的 `.ts` 文件就绕开了这个问题：**新增图标零手工，拼写保护一点不丢**。

## 启动开销

**零。** 转换发生在编译期，产物就是一个普通 React 组件 —— 运行时没有 SVG 解析、
没有额外请求、没有全局注册表，与手写一个图标组件的产物完全一致。
