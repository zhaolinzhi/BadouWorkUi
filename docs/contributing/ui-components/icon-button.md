# IconButton

图标按钮。

主应用与三个微应用里到处是「一个图标 + 一个方块」的按钮，尺寸、圆角、hover 底色各写各的。共享层把它收敛成一份尺寸契约。

- 源码：[`packages/ui/src/components/IconButton.tsx`](../../../packages/ui/src/components/IconButton.tsx)
- 测试：[测试文件 `IconButton.dom.test.tsx`](../../../packages/ui/src/components/__tests__/IconButton.dom.test.tsx)

## Props

| 属性          | 类型                 | 默认值    | 说明                                    |
| ------------- | -------------------- | --------- | --------------------------------------- |
| `icon`        | `ReactNode`          | —         | 图标内容，通常是 `<AppIcon />`          |
| `label`       | `string`             | —         | **必填**。无障碍名称，落到 `aria-label` |
| `onClick`     | `(e: Event) => void` | —         | 点击回调                                |
| `type`        | Arco 的 `type`       | `'text'`  | 按钮类型                                |
| `size`        | Arco 的 `size`       | `'small'` | 尺寸                                    |
| `status`      | Arco 的 `status`     | —         | 状态色。`danger` 用于删除类操作         |
| `disabled`    | `boolean`            | `false`   | 禁用                                    |
| `loading`     | `boolean`            | `false`   | 加载中                                  |
| `className`   | `string`             | —         | 附加 className                          |
| `data-testid` | `string`             | —         | 落到根按钮上的 `data-testid`            |

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

## 相关

- [AppIcon](app-icon.md) —— `icon` 槽位通常放它。
- [MoreMenu](more-menu.md) —— 「⋮」触发按钮本质也是图标按钮，但带下拉菜单，用 `MoreMenu`。
