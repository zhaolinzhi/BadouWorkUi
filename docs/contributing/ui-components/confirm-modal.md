# ConfirmModal

二次确认弹窗。

收拢 notes 的 `DeleteConfirmModal` 与 knowledge-base 的 `DeleteKnowledgeBaseModal` —— 两处几乎逐字相同的 Arco `Modal` 包装（同样的宽度、同样的 danger 确认按钮、同样的 z-index）。

- 源码：[`packages/ui/src/components/ConfirmModal.tsx`](../../../packages/ui/src/components/ConfirmModal.tsx)
- 测试：[测试文件 `ConfirmModal.dom.test.tsx`](../../../packages/ui/src/components/__tests__/ConfirmModal.dom.test.tsx)

## Props

| 属性          | 类型         | 默认值  | 说明                                   |
| ------------- | ------------ | ------- | -------------------------------------- |
| `visible`     | `boolean`    | —       | 是否显示                               |
| `title`       | `ReactNode`  | —       | 标题                                   |
| `description` | `ReactNode`  | —       | 说明文字。省略时整段不渲染             |
| `children`    | `ReactNode`  | —       | 附加内容，渲染在说明文字之后           |
| `okText`      | `ReactNode`  | —       | 确认按钮文案                           |
| `cancelText`  | `ReactNode`  | —       | 取消按钮文案                           |
| `onOk`        | `() => void` | —       | 点击确认                               |
| `onCancel`    | `() => void` | —       | 点击取消（右上角关闭、遮罩、ESC 同理） |
| `danger`      | `boolean`    | `false` | 确认按钮走危险态（删除类操作）         |
| `okLoading`   | `boolean`    | `false` | 确认按钮加载中                         |
| `hideCancel`  | `boolean`    | `false` | 隐藏取消按钮                           |
| `className`   | `string`     | —       | 附加 className                         |

## 用法

```tsx
<ConfirmModal
  visible={deleteTarget !== null}
  title={t('settings.notesDeleteNote', { defaultValue: 'Delete Note' })}
  description={t('settings.notesDeleteNoteConfirm', {
    defaultValue: 'Are you sure you want to delete this note?',
  })}
  okText={t('common.delete', { defaultValue: 'Delete' })}
  cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
  danger
  onCancel={handleDeleteCancel}
  onOk={handleDeleteConfirm}
/>
```

需要额外信息（比如「即将删除的知识库：XXX」）时放进 `children`：

```tsx
<ConfirmModal visible title='…' description='…' onOk={…} onCancel={…}>
  <div className='mt-12px flex items-center gap-12px rounded-lg bg-fill-2 p-12px'>
    <KnowledgeBaseAvatar knowledgeBase={kb} size={32} />
    <div>{kb.name}</div>
  </div>
</ConfirmModal>
```

## 行为约定

- **零内置文案**。不传 `okText` / `cancelText` 会回落到 Arco 自带的默认文案（确定 / 取消）—— 业务代码应当始终传入 i18n 文案。
- **弹窗挂在 `document.body`**（Arco 的默认行为，这里显式写出来），并且 z-index 压过 shell：`wrap` 10000 / 遮罩 9999。shell 的 `.arco-message-wrapper` 是 10001 —— toast 盖在弹窗之上是对的，「操作失败」的提示本来就该压在确认框上面。
- `danger` 时确认按钮是 Arco 的 `status='danger'`；`okLoading` 时确认按钮进入加载态。

## 相关

- [AppHeader](app-header.md) —— 触发确认弹窗的操作通常放在它的 `trailing` 槽位里。
