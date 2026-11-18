# IconButton

图标按钮。

主应用与三个微应用里到处是「一个图标 + 一个方块」的按钮，尺寸、圆角、hover 底色各写各的。共享层把它收敛成一份尺寸契约。

- 源码：[`packages/ui/src/components/IconButton.tsx`](../../../packages/ui/src/components/IconButton.tsx)
- 测试：[测试文件 `IconButton.dom.test.tsx`](../../../packages/ui/src/components/__tests__/IconButton.dom.test.tsx)

## Props

| 属性                                            | 类型                 | 默认值    | 说明                                    |
| ----------------------------------------------- | -------------------- | --------- | --------------------------------------- |
| `icon`                                          | `ReactNode`          | —         | 图标内容，通常是 `<AppIcon />`          |
| `label`                                         | `string`             | —         | **必填**。无障碍名称，落到 `aria-label` |
| `onClick`                                       | `(e: Event) => void` | —         | 点击回调                                |
| `type`                                          | Arco 的 `type`       | `'text'`  | 按钮类型                                |
| `size`                                          | Arco 的 `size`       | `'small'` | 尺寸                                    |
| `status`                                        | Arco 的 `status`     | —         | 状态色。`danger` 用于删除类操作         |
| `disabled`                                      | `boolean`            | `false`   | 禁用                                    |
| `loading`                                       | `boolean`            | `false`   | 加载中                                  |
| `title`                                         | `string`             | —         | 原生 `title` 提示（悬停时显示）         |
| `className`                                     | `string`             | —         | 附加 className                          |
| `data-testid`                                   | `string`             | —         | 落到根按钮上的 `data-testid`            |
| `onMouseEnter` / `onMouseLeave` / `onMouseMove` | 鼠标事件             | —         | 透传给底层按钮                          |
| `onMouseDown` / `onContextMenu`                 | 鼠标事件             | —         | 透传给底层按钮                          |
| `onFocus` / `onBlur` / `onKeyDown`              | 焦点 / 键盘事件      | —         | 透传给底层按钮                          |
| `style`                                         | `CSSProperties`      | —         | 透传给底层按钮的行内样式                |

组件同时**转发 `ref`**（指向真实的 `<button>` 元素）。

## 用法

```tsx
<IconButton
  icon={<AppIcon name='delete' />}
  label={t('common.delete', { defaultValue: 'Delete' })}
  status='danger'
  onClick={handleDelete}
/>
```

## 行为约定

- **`label` 必填**。图标按钮没有文字，`aria-label` 是读屏软件唯一的线索 —— 缺了它只能念出「按钮」。
- 底层是 Arco `Button`：禁用时 `disabled` 属性到位且**不触发** `onClick`；`loading` 时按钮进入加载态。
- Arco 的 icon-only 按钮本来就按 `size` 给正方形（mini / small / default / large → 24 / 28 / 32 / 36），共享层只统一圆角（`!rounded-8px`）。
- **不要用 `AppIcon` 的 `onClick` 代替它** —— `AppIcon` 的 `onClick` 没有键盘可达性，也没有 `aria-label`。图标按钮一律走 `IconButton`。
- 密集列表里可以覆写方框尺寸：`className='!h-18px !w-18px'`。Arco 的尺寸是 `!important` 之外的普通声明，`!` 前缀能盖掉它。

### 转发 ref 与事件 —— 为什么不能省

Arco 的 `Tooltip` / `Popconfirm` 都建在 `Trigger` 上，而 `Trigger` 会**克隆直接子节点**：

- 挂 `ref` 来定位浮层 → 子节点必须转发 ref，否则抛「Function components cannot be given refs」。
- 注入 `onMouseEnter` / `onMouseLeave` / `onClick` / `onFocus` / `onBlur` / `onKeyDown` / `onContextMenu` → 子节点必须转发这些事件，否则浮层永远弹不出来。

共享层因此做了两件事：

1. 组件本体是 `React.forwardRef`，`ref` 指向真实的 `<button>`。
2. 上表里的事件属性原样转发给底层按钮。

另外，组件在类型上挂了 `__BYTE_BUTTON` 标记 —— Arco 的 `Trigger` 靠它判断「子节点是个禁用按钮」，禁用时给它套一层 `<span>` 并把 `pointer-events: none` 挪到内层按钮上，靠这层壳**禁用按钮也能弹出悬停提示**。少了这个标记，禁用态的提示会静默失效。

## 相关

- [AppIcon](app-icon.md) —— `icon` 槽位通常放它。
- [MoreMenu](more-menu.md) —— 「⋮」触发按钮本质也是图标按钮，但带下拉菜单，用 `MoreMenu`。
