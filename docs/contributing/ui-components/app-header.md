# AppHeader

顶部条。

notes 的工具条、knowledge-base 的编辑页顶部条，骨架是一样的：左侧返回 / 中间标题 / 右侧操作。共享层只管骨架，内容一律由调用方通过插槽传进来。

- 源码：[`packages/ui/src/components/AppHeader.tsx`](../../../packages/ui/src/components/AppHeader.tsx)
- 测试：[测试文件 `AppHeader.dom.test.tsx`](../../../packages/ui/src/components/__tests__/AppHeader.dom.test.tsx)

## Props

| 属性        | 类型        | 默认值 | 说明                           |
| ----------- | ----------- | ------ | ------------------------------ |
| `title`     | `ReactNode` | —      | 主标题                         |
| `subtitle`  | `ReactNode` | —      | 副标题（计数、状态说明等）     |
| `leading`   | `ReactNode` | —      | 左侧插槽，通常是返回按钮       |
| `trailing`  | `ReactNode` | —      | 右侧插槽，通常是操作按钮组     |
| `children`  | `ReactNode` | —      | 尾部插槽，排在 `trailing` 之后 |
| `sticky`    | `boolean`   | `true` | 是否吸顶                       |
| `className` | `string`    | —      | 附加 className                 |

## 用法

```tsx
<AppHeader
  leading={
    <Button type='text' icon={<AppIcon name='arrow-left' />} onClick={handleBack}>
      {t('common.back', { defaultValue: 'Back' })}
    </Button>
  }
  title={activeNote?.title ?? t('settings.notes', { defaultValue: 'Notes' })}
  trailing={
    <>
      <Button icon={<AppIcon name='download' />} onClick={handleExport}>
        {t('settings.notesExport', { defaultValue: 'Export' })}
      </Button>
      <Button status='danger' icon={<AppIcon name='delete' />} onClick={handleClear}>
        {t('settings.notesClear', { defaultValue: 'Clear' })}
      </Button>
    </>
  }
/>
```

## 行为约定

- **插槽式布局** —— 组件自己不认识「返回」是什么，它只提供位置。
- **零内置文案**，标题与副标题都由调用方传入。
- **只用语义 token**：`bg-1`（面板底色）、`border-b-b-base`（`--border-base`）。
- **边框显式写了 `border-solid`**。shell 的 preflight 会给所有元素兜底 `border-style: solid`，但微应用独立运行时没有 preflight —— 不写的话分隔线在 shell 里可见、在独立运行时不可见，两处观感不一致。

## 相关

- [ConfirmModal](confirm-modal.md) —— `trailing` 里的删除按钮通常触发它。
- [AppIcon](app-icon.md) —— 槽位里的图标用它。
