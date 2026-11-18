# EmptyState

空状态。统一成「图标 → 主文案 → 辅助说明 → 操作入口」的竖排结构。

- 源码：[`packages/ui/src/components/EmptyState.tsx`](../../../packages/ui/src/components/EmptyState.tsx)
- 测试：[测试文件 `EmptyState.dom.test.tsx`](../../../packages/ui/src/components/__tests__/EmptyState.dom.test.tsx)

## Props

| 属性          | 类型        | 说明                           |
| ------------- | ----------- | ------------------------------ |
| `icon`        | `ReactNode` | 顶部图标，通常是 `<AppIcon />` |
| `title`       | `ReactNode` | 主文案                         |
| `description` | `ReactNode` | 辅助说明                       |
| `action`      | `ReactNode` | 底部操作入口                   |
| `className`   | `string`    | 根容器附加 className           |

## 用法

```tsx
<EmptyState
  icon={<AppIcon name='notes' size={48} />}
  title={t('settings.notesNoSelection', { defaultValue: 'Select a note to start editing' })}
  description={t('settings.notesNoSelectionHint', {
    defaultValue: 'Choose a note from the sidebar, or create a new one.',
  })}
/>
```

## 行为约定

- **可选内容缺失时整块不渲染**。空占位会撑出多余高度，视觉上表现为「文案下面凭空多出一段空白」。
- 每个可选区都有独立 `data-testid`：`empty-state` / `empty-state-icon` / `empty-state-title` / `empty-state-description` / `empty-state-action`，便于断言某块**不存在**。

## 相关

- [AsyncBoundary](async-boundary.md) —— 它的 `emptyContent` 默认就渲染一个 `EmptyState`。
- [AppIcon](app-icon.md) —— `icon` 槽位通常放它。
