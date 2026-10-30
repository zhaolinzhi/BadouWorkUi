# AppIcon

统一图标渲染。

主应用的 icon-park 图标被构建期 `iconParkPlugin`（`packages/desktop/electron.vite.config.ts`）自动套上 `IconParkHOC`，强制 size=16 / strokeWidth=3 / fill=固定色；三个微应用没装这个 plugin，图标是裸的 —— 描边更粗（4）、颜色跟随文字色、尺寸五花八门。`AppIcon` 统一了这套参数。

- 源码：[`packages/ui/src/components/AppIcon.tsx`](../../../packages/ui/src/components/AppIcon.tsx)
- 测试：[测试文件 `AppIcon.dom.test.tsx`](../../../packages/ui/src/components/__tests__/AppIcon.dom.test.tsx)

## Props

| 属性          | 类型                | 默认值           | 说明                                                            |
| ------------- | ------------------- | ---------------- | --------------------------------------------------------------- |
| `name`        | `AppIconName`       | —                | 语义名，走内置映射表                                            |
| `icon`        | `AppIconComponent`  | —                | 直接透传任意 icon-park 组件；**与 `name` 同时给时 `icon` 优先** |
| `size`        | `number`            | `16`             | 像素                                                            |
| `fill`        | `string`            | `'currentColor'` | 描边色。默认跟随文字色，明暗主题自动适配                        |
| `strokeWidth` | `number`            | `3`              | 描边宽度                                                        |
| `className`   | `string`            | —                | 附加 className（挂在 icon-park 的外层 span 上）                 |
| `interactive` | `boolean`           | `false`          | 为 `true` 才加 `cursor-pointer`                                 |
| `onClick`     | `MouseEventHandler` | —                | 点击回调，透传到图标组件的根 `<span>`                           |

## 用法

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

需要新图标时，**在 `packages/ui/src/components/icons.ts` 里静态 import 具体图标后加进 `ICON_MAP`**，不要在业务代码里直接 `import { Xxx } from '@icon-park/react'` —— 那样会绕过统一参数，图标又变回裸的。

> 映射表必须用**静态 import**。写成 `import * as` 或动态 import 会把整个图标库打进 bundle，tree-shaking 失效。

## 行为约定

- `name` 不在映射表里、或既没给 `name` 也没给 `icon` → **渲染 `null`，不抛错**。一个图标不该让整页崩掉。
- `cursor-pointer` 只在 `interactive` 时加。主应用的 `IconParkHOC` 给所有图标强加手型光标，连 `<FileText size={14} />` 这种纯装饰图标也会变手型 —— 这个缺陷不在共享层复现。

## 相关

- [IconButton](icon-button.md) —— 需要键盘可达的图标按钮用它，不要用 `AppIcon` 的 `onClick`。
- [MoreMenu](more-menu.md) —— 默认的「⋮」图标就是 `more-one`。
