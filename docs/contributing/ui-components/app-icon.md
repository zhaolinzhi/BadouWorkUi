# AppIcon

统一图标渲染。

主应用的 icon-park 图标被构建期 `iconParkPlugin`（`packages/desktop/electron.vite.config.ts`）自动套上 `IconParkHOC`，强制 size=16 / strokeWidth=3 / fill=固定色；三个微应用没装这个 plugin，图标是裸的 —— 描边更粗（4）、颜色跟随文字色、尺寸五花八门。`AppIcon` 统一了这套参数。

- 源码：[`packages/ui/src/components/AppIcon.tsx`](../../../packages/ui/src/components/AppIcon.tsx)
- 测试：[测试文件 `AppIcon.dom.test.tsx`](../../../packages/ui/src/components/__tests__/AppIcon.dom.test.tsx)

## Props

| 属性          | 类型                | 默认值           | 说明                                                                          |
| ------------- | ------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `name`        | `AppIconName`       | —                | 语义名，走内置映射表                                                          |
| `icon`        | `AppIconComponent`  | —                | 直接透传任意 icon-park 组件或定制图标组件；**与 `name` 同时给时 `icon` 优先** |
| `size`        | `number`            | `16`             | 像素                                                                          |
| `fill`        | `string`            | `'currentColor'` | 描边色。默认跟随文字色，明暗主题自动适配                                      |
| `strokeWidth` | `number`            | `3`              | 描边宽度                                                                      |
| `className`   | `string`            | —                | 附加 className（挂在 icon-park 的外层 span 上）                               |
| `interactive` | `boolean`           | `false`          | 为 `true` 才加 `cursor-pointer`                                               |
| `onClick`     | `MouseEventHandler` | —                | 点击回调，透传到图标组件的根 `<span>`                                         |

## 用法

`AppIcon` 已**全局注册**，业务文件里不用 import（机制见[公共组件手册 §4](README.md#4-图标与按钮免-import-直接用)）：

```tsx
// 语义名（推荐）：产品内统一指向同一个图标
<AppIcon name='notes' size={48} />

// 覆盖参数
<AppIcon name='plus' size={20} fill='var(--primary)' />

// 透传映射表里没有的 icon-park 图标
import { IconApps } from '@icon-park/react';
<AppIcon icon={IconApps} size={16} />

// 可点击
<AppIcon name='delete' interactive onClick={handleDelete} />
```

> 传了 `onClick` 就该同时开 `interactive` —— 否则光标不会变成手型，用户不知道这里能点。
>
> 图标本身不是按钮（无 `role`、无键盘可达性）。真正需要键盘可达的交互请用 Arco 的 `<Button icon={<AppIcon name='delete' />} />`；`onClick` 只服务于「图标嵌在一个已经可点的行/卡片里」这种场景。

## 图标语义名全表

`ICON_MAP` 是 `icon-park` 组件名的 kebab-case 映射，外加一组产品语义别名。

| 语义名           | 实际图标     | 备注                   |
| ---------------- | ------------ | ---------------------- |
| `arrow-left`     | `ArrowLeft`  |                        |
| `book`           | `Book`       |                        |
| `book-one`       | `BookOne`    |                        |
| `delete`         | `Delete`     |                        |
| `download`       | `Download`   |                        |
| `down`           | `Down`       |                        |
| `file-text`      | `FileText`   |                        |
| `folder-open`    | `FolderOpen` |                        |
| `info`           | `Info`       |                        |
| `more-one`       | `MoreOne`    | 「更多」菜单           |
| `plus`           | `Plus`       |                        |
| `refresh`        | `Refresh`    |                        |
| `robot`          | `Robot`      |                        |
| `tips`           | `Tips`       |                        |
| `notes`          | `Notes`      | 笔记（产品语义别名）   |
| `knowledge-base` | `Book`       | 知识库（产品语义别名） |
| `recording`      | `Microphone` | 录音（产品语义别名）   |
| `record`         | `Record`     |                        |
| `microphone`     | `Microphone` |                        |

## 如何新增一个图标

### 先分清是哪一种

| 情况                                                 | 走哪条路                                            |
| ---------------------------------------------------- | --------------------------------------------------- |
| icon-park 的 2658 个里有能表达意思的                 | **路径 A** —— 直接 import 一个图标                  |
| 没有 —— 页面重新设计，图标是单独定制的               | **路径 B** —— SVG 丢进 `icons/svg/`，构建期自动转换并登记 |
| 同一个图标在多处表达同一件事（如「知识库」到处出现） | 两条路都要登记，再加一条**语义别名**                |
| 只临时用一次，不值得进映射表                         | 走 `icon` 透传：`<AppIcon icon={X} />`              |

两条路的终点是一样的：**有一个 kebab-case 的语义名**，
之后全产品（主应用 + 三个微应用）都能直接写 `<AppIcon name='...' />`。
路径 A 要手工登记，路径 B 放进文件夹就自动登记。

---

### 路径 A：icon-park 里就有

#### A1. 查清图标名（**不用下载任何文件**）

> **本仓库不从任何地方下载图标文件。** 2658 个图标的本体已经装在 `node_modules/@icon-park/react` 里 ——
> 每个图标就是一个 React 组件，内部是一段内联 SVG。`import { DeleteOne } from '@icon-park/react'` 直接就能用。
>
> [iconpark 官网](https://iconpark.oceanengine.com) 只用来看图、搜中文名。它「下载」按钮给的是 **iconfont 那套**
> （css + ttf/svg，给 `<i class='iconfont icon-xxx'>` 这种非 React 项目用的）—— **不要下进本仓库**，
> 那会变成第二套图标系统，`AppIcon` 统一的 size / strokeWidth / fill 全都管不到它。

`@icon-park/react` 是 `packages/ui` 的 peerDependency（`^1.4.2`），已装好。带中文注释的完整清单在 `node_modules/@icon-park/react/icons.json`：

```bash
# 按中文名搜
node -e "console.log(require('@icon-park/react/icons.json').filter(i=>i.title.includes('删除')))"
```

每条记录长这样：

```json
{
  "id": 660,
  "title": "删除",
  "name": "delete-one",
  "category": "Edit",
  "categoryCN": "编辑",
  "tag": ["删除", "垃圾桶"]
}
```

- **`name`** 是 kebab-case（`delete-one`）—— 这就是要写进 `ICON_MAP` 的键。
- **React 组件名是它的 PascalCase 形式**（`DeleteOne`），从 `@icon-park/react` 根入口导入。
- `title` / `tag` / `categoryCN` 都是中文 —— 直接搜中文名最快。
- 想看图长什么样，去 [iconpark 官网](https://iconpark.oceanengine.com) 搜中文名。

#### A2. 改 `packages/ui/src/components/icons/index.ts`

两处改动，缺一不可：

```ts
// ① 顶部静态 import —— 必须具名静态导入
import { DeleteOne } from '@icon-park/react';

// ② 加进映射表
export const ICON_MAP = {
  // —— 功能类(icon-park 组件名的 kebab-case)——
  'delete-one': DeleteOne,

  // —— 产品语义别名 ——
  'knowledge-base': Book,
} as const satisfies Record<string, AppIconComponent>;
```

- **必须静态 import**。`import * as` 或动态 `import()` 会把整个图标库打进 bundle，tree-shaking 失效。
- **基础键用 kebab-case**（`MoreOne` → `more-one`），心智负担最小；**产品语义别名**指向已有图标（`knowledge-base` → `Book`）。
- **类型不用改**：`AppIconName = keyof typeof ICON_MAP`，加了键类型自动跟着扩。

#### A3 + A4. 更新文档、验证

见下面[「两条路都要做的两件事」](#两条路都要做的两件事)。

---

### 路径 B：定制图标（icon-park 里没有）

页面重新设计时经常需要**单独定制**的图标 —— icon-park 的 2658 个覆盖不到。
这种图标**不要**做成 `assets/*.svg` 再用 `<img src>` 引进来：图片是死的，颜色写死在文件里、
尺寸不随字号变、不跟随明暗主题 —— 正是 `AppIcon` 要消灭的那类不一致。

**做法：把 SVG 丢进文件夹，构建期自动转成 React 组件。** 转出来的组件行为和 icon-park 图标完全一致。

#### B1. 把 SVG 放进 `icons/svg/`

设计稿导出的 SVG 原样丢进 [`packages/ui/src/components/icons/svg/`](../../../packages/ui/src/components/icons/svg/) 即可，
**文件名 = 语义名**（kebab-case），比如 `star-badge.svg`：

```svg
<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path
    d="M9.60416 1.91176C9.64068 1.83798 9.6971 1.77587 9.76704 1.73245C..."
    stroke="currentColor"
    stroke-width="1.66667"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
```

#### B2. 编译期自动转换 + 自动登记（**不用改代码**）

构建期插件 `aionuiSvgIconPlugin`（[`packages/ui/src/vite/svgIconPlugin.ts`](../../../packages/ui/src/vite/svgIconPlugin.ts)）
做两件事：

1. 把 `*.svg?component` 的导入编译成一个普通 React 组件；
2. **扫描 `icons/svg/` 目录**，生成 [`icons/svg.generated.ts`](../../../packages/ui/src/components/icons/svg.generated.ts)，
   里面是自动登记的映射表。

`icons/index.ts` 把这张表合并进 `ICON_MAP`：

```ts
export const ICON_MAP = {
  ...ICON_PARK_MAP, // ← icon-park 自带的，手工维护
  ...CUSTOM_ICON_MAP, // ← 定制图标，构建期自动生成
} as const satisfies Record<string, AppIconComponent>;
```

**所以新增定制图标只要丢文件，不用 import、也不用改 `ICON_MAP`。**

> **dev 期间不用重启 dev server。**
> 插件在 dev server 起来后会盯着 `icons/svg/` 目录 —— 新增或删除 SVG 的瞬间
> 映射表就重新生成，页面自动重新加载。构建时也一样：每次构建都会重新生成。
> 只有一种情况要手动重来：**新加了图标但 TS 还报「不在 `AppIconName` 里」** ——
> 那是编辑器的类型服务还没看到新生成的 `.ts` 文件，重启一下 TS 服务（VS Code：_TypeScript: Restart TS Server_）即可。

转换规则：

| 设计稿里的东西                                                   | 编译后的行为                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `stroke` / `stroke-width` / `stroke-linecap` / `stroke-linejoin` | **删掉** —— 由外层 `<svg>` 统一给，`AppIcon` 的参数才真的生效       |
| `stroke="none"`                                                  | 保留 —— 那是「这一笔不描边」的意思                                  |
| `viewBox`                                                        | 原样保留 —— 改了形状会变形                                          |
| 写死的颜色（`fill="#86909C"`）                                   | 保留，但**不跟随主题**，构建时会打印提示                            |
| `clip-path` / `fill-rule`                                        | 转成 React 的驼峰写法（`clipPath` / `fillRule`），否则 React 报警告 |
| `id`                                                             | 加图标名前缀 —— 避免两个图标的同名 `id` 在同一页撞车                |

描边粗细按**设计稿自己的比例**换算（`strokeWidth={3}` 复现设计稿的粗细）。
24 画布 + 1.5 描边（6.25%）与 icon-park 恰好同比例，两套图标看起来一样粗。

> **启动开销：零。**
> 转换发生在编译期，产物就是一个普通 React 组件 —— 运行时没有 SVG 解析、没有额外 HTTP 请求、
> 没有全局注册表，与手写一个图标组件的产物完全一致。多出来的只有构建期每个图标几毫秒的转换时间。
> 真正会给启动添负担的是**运行时**才去解析 SVG（`dangerouslySetInnerHTML` 塞字符串、或 `<img src>` 拉图），
> 本仓库不走那条路。

> **为什么生成文件，而不是 `import.meta.glob` 自动注册**：
> `import.meta.glob` 的返回类型写死了是 `Record<string, T>` —— key 是 `string` 而不是字面量。
> 于是 `AppIconName = keyof typeof ICON_MAP` 会从字面量联合塌成 `string`，
> `<AppIcon name='plsu' />` 编译期就不再报错 —— 全仓库几千处调用的拼写保护全没了。
> 生成成真实的 `.ts` 文件就绕开了这个问题：**新增图标零手工，拼写保护一点不丢**。

#### B3. 补文档表

见下面[「两条路都要做的两件事」](#两条路都要做的两件事)。

> **语义名不能和 icon-park 已有的撞车**。上面例子里 icon-park 有 `star`，所以定制图标另起了
> `star-badge`。撞名的后果是定制图标覆盖 icon-park 的那个（有守卫测试会报错）。
>
> **文件名以 `_` 开头的不自动登记**（比如 `_sample-icon.svg`）——
> 留给「只想用这个 SVG、不想进全局映射表」的场景。`_` 只是标记，不是名字的一部分。

---

### 两条路都要做的两件事

#### ① 回来更新本文档的「图标语义名全表」

上面那张表是**手工维护**的。加了新图标必须回来补一行，否则文档与代码对不上 —— 有守卫测试盯着。

路径 B 的图标是自动登记的，但**文档表不会自动更新** —— 守卫测试会直接告诉你缺哪个名字：

```
新增图标后请把 star-badge 补进 app-icon.md 的「图标语义名全表」
```

定制图标在备注列标一下（如「定制图标」），方便别人知道它不是 icon-park 自带的。

#### ② 验证

```bash
bunx vitest run packages/ui                                   # 含「映射表与文档表一致」的守卫测试
bunx tsc --noEmit -p packages/ui/tsconfig.json                # 类型
```

`AppIcon` 是**全局注册**的（见[公共组件手册 §4](README.md#4-图标与按钮免-import-直接用)），新加的语义名**不用 import**就能直接写：

```tsx
<AppIcon name='delete-one' />
```

### 坑

| 现象                                          | 原因                                                  | 修法                                                                                        |
| --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 键名报「不在 `AppIconName` 里」               | `ICON_MAP` 里没这个键                                 | 补上键；类型是从映射表推的，不用单独改类型                                                  |
| 运行时 `AppIcon` 渲染成空白                   | 键名拼错，或组件没 import 进来                        | 对照 `icons.json` 的 `name`；检查静态 import 是否存在                                       |
| 从官网下了 svg / iconfont 的 css              | 以为「添加图标」= 下载文件                            | 删掉。本仓库不下载图标，`import { Xxx } from '@icon-park/react'` 就够                       |
| bundle 体积暴涨                               | 用了 `import * as` / 动态 import                      | 改成具名静态 import                                                                         |
| 图标大小 / 描边和别处不一样                   | 业务代码直接 `import { Xxx } from '@icon-park/react'` | 改用 `<AppIcon name='...' />`，参数由共享层统一                                             |
| 新键在主应用能显示、微应用里是裸的            | 绕过了 `AppIcon`，直接渲染了 icon-park 组件           | 同上 —— 微应用没有 `iconParkPlugin`，只有 `AppIcon` 会统一参数                              |
| 定制图标颜色不跟随主题                        | SVG 里写死了 `fill="#86909C"` / `stroke="#000"`       | 改成 `currentColor`（外层 `<svg>` 的 `style.color` 已经跟着 `fill` 走）；构建时也会打印提示 |
| 定制图标形状变形                              | SVG 的 `viewBox` 被改了                               | `viewBox` 原样保留                                                                          |
| 定制图标跟某个已有图标长得一样                | 语义名撞了，定制图标把 icon-park 的那个覆盖了         | 换个不冲突的语义名（守卫测试会报出撞车的名字）                                              |
| 新加了 SVG，名字却报「不在 `AppIconName` 里」 | 编辑器的类型服务还没看到新生成的注册表                | 重启一下 TS 服务（VS Code：_TypeScript: Restart TS Server_）—— `svg.generated.ts` 是生成物  |
| 手改了 `svg.generated.ts`                     | 它是**生成物**                                        | 别手改；下一次构建会覆盖。要改就改 `svg/` 下的 SVG                                          |
| 导入定制图标报「找不到模块」                  | 少了 `?component`，或该工程没装 `aionuiSvgIconPlugin` | 加上查询参数；四个构建入口都要装这个插件（见下）                                            |
| 改了 SVG 页面没变                             | 只改了文件没重新构建                                  | dev server 会自动重编译；生产构建重新跑一次即可                                             |

## 行为约定

- `name` 不在映射表里、或既没给 `name` 也没给 `icon` → **渲染 `null`，不抛错**。一个图标不该让整页崩掉。
- `cursor-pointer` 只在 `interactive` 时加。主应用的 `IconParkHOC` 给所有图标强加手型光标，连 `<FileText size={14} />` 这种纯装饰图标也会变手型 —— 这个缺陷不在共享层复现。

## 相关

- 定制图标的 SVG 源文件目录：[`packages/ui/src/components/icons/svg/`](../../../packages/ui/src/components/icons/svg/)
- 编译期转换插件：[`packages/ui/src/vite/svgIconPlugin.ts`](../../../packages/ui/src/vite/svgIconPlugin.ts) 与 [`svgToReact.ts`](../../../packages/ui/src/vite/svgToReact.ts)
- 自动登记的生成逻辑：[`packages/ui/src/vite/customIconRegistry.ts`](../../../packages/ui/src/vite/customIconRegistry.ts)
- 生成物（**别手改**）：[`packages/ui/src/components/icons/svg.generated.ts`](../../../packages/ui/src/components/icons/svg.generated.ts)
- 定制图标工厂（手写组件时用）：[`packages/ui/src/components/icons/customIcons.tsx`](../../../packages/ui/src/components/icons/customIcons.tsx)
- 映射表源码：[`packages/ui/src/components/icons/index.ts`](../../../packages/ui/src/components/icons/index.ts)
- [IconButton](icon-button.md) —— 需要键盘可达的图标按钮用它，不要用 `AppIcon` 的 `onClick`。
- [MoreMenu](more-menu.md) —— 默认的「⋮」图标就是 `more-one`。

> **`aionuiSvgIconPlugin` 要装在每个构建入口**，少一个就会出现「类型过了、构建时找不到模块」：
>
> | 入口       | 位置                                                   |
> | ---------- | ------------------------------------------------------ |
> | 主应用     | `packages/desktop/electron.vite.config.ts` 的 renderer |
> | 三个微应用 | 各自的 `vite.config.ts` 的 `plugins`                   |
> | 根测试     | `vitest.config.ts` 的 `plugins`                        |
