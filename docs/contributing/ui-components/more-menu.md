# MoreMenu

「更多」菜单。

收拢 notes 的 `NoteItem` / `NotebookItem` 与 knowledge-base 的 `KnowledgeBaseRow` 各写一份的「⋮ → Arco Dropdown → Menu」组合 —— 连触发按钮的 class 都一样。

- 源码：[`packages/ui/src/components/MoreMenu.tsx`](../../../packages/ui/src/components/MoreMenu.tsx)
- 测试：[测试文件 `MoreMenu.dom.test.tsx`](../../../packages/ui/src/components/__tests__/MoreMenu.dom.test.tsx)

## Props

| 属性          | 类型                    | 默认值     | 说明                             |
| ------------- | ----------------------- | ---------- | -------------------------------- |
| `items`       | `MoreMenuItem[]`        | —          | 菜单项                           |
| `onSelect`    | `(key: string) => void` | —          | 选中某项，回调参数是该项的 `key` |
| `onClick`     | `(e: Event) => void`    | —          | 触发按钮的点击回调               |
| `label`       | `string`                | —          | **必填**。触发按钮的无障碍名称   |
| `icon`        | `ReactNode`             | `more-one` | 触发按钮图标                     |
| `disabled`    | `boolean`               | `false`    | 禁用整个菜单                     |
| `size`        | Arco 的 `size`          | `'small'`  | 触发按钮尺寸                     |
| `className`   | `string`                | —          | 附加 className（落在触发按钮上） |
| `data-testid` | `string`                | —          | 落到触发按钮上的 `data-testid`   |

`MoreMenuItem`：

| 属性       | 类型        | 说明                                  |
| ---------- | ----------- | ------------------------------------- |
| `key`      | `string`    | 菜单项标识，`onSelect` 回调时原样返回 |
| `label`    | `ReactNode` | 菜单项文案                            |
| `icon`     | `ReactNode` | 菜单项图标                            |
| `danger`   | `boolean`   | 危险项（删除等）—— 文字转危险色       |
| `disabled` | `boolean`   | 禁用。禁用的项不会触发 `onSelect`     |
| `testId`   | `string`    | 落到菜单项上的 `data-testid`          |

## 用法

```tsx
<MoreMenu
  items={[
    { key: 'rename', label: t('settings.notesRename', { defaultValue: 'Rename' }) },
    {
      key: 'delete',
      label: t('settings.notesDeleteNote', { defaultValue: 'Delete Note' }),
      danger: true,
    },
  ]}
  label={t('common.more', { defaultValue: 'More' })}
  onSelect={(key) => {
    if (key === 'rename') setIsEditing(true);
    else if (key === 'delete') onDelete(note.id);
  }}
  onClick={(e) => e.stopPropagation()}
/>
```

## 行为约定

- **弹层挂在 `document.body`**。qiankun 微应用的容器有 `overflow` 与层叠上下文，弹层留在容器里会被裁掉 —— 这是微应用里最常见的「菜单点开了却看不见」。
- **菜单项用 key 回调**，不让调用方在 `onClick` 里比对文案 —— 文案会变、会走 i18n，比对文案必然漏。
- **列表行里要传 `onClick` 阻止冒泡**。整行都是可点的话，点「更多」会连带选中这一行。Arco 的 Dropdown 会先调子元素的 `onClick` 再开弹层，所以 `stopPropagation()` 不会影响菜单弹出。
- 触发按钮是 Arco `Button`（不是裸 `<button>`），图标默认 `more-one`。

## 相关

- [IconButton](icon-button.md) —— 不带菜单的图标按钮用它。
- [AppIcon](app-icon.md) —— 默认图标就是 `more-one`。
