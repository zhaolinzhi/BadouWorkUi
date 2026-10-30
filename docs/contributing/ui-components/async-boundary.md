# AsyncBoundary

异步数据的四态边界：loading / error / empty / content。

- 源码：[`packages/ui/src/components/AsyncBoundary.tsx`](../../../packages/ui/src/components/AsyncBoundary.tsx)
- 测试：[测试文件 `AsyncBoundary.dom.test.tsx`](../../../packages/ui/src/components/__tests__/AsyncBoundary.dom.test.tsx)

## Props

| 属性             | 类型                         | 说明                                            |
| ---------------- | ---------------------------- | ----------------------------------------------- |
| `loading`        | `boolean`                    | 是否加载中。**优先级最高**                      |
| `error`          | `ReactNode \| Error \| null` | 错误信息。传 `Error` 对象时自动取 `message`     |
| `isEmpty`        | `boolean`                    | 结果是否为空                                    |
| `onRetry`        | `() => void`                 | 重试回调                                        |
| `loadingContent` | `ReactNode`                  | 加载态内容。默认渲染一个纯视觉的 `<Spin />`     |
| `errorContent`   | `ReactNode`                  | 错误态标题                                      |
| `emptyContent`   | `ReactNode`                  | 空态内容。默认渲染一个无文案的 `<EmptyState />` |
| `retryText`      | `ReactNode`                  | 重试按钮文案                                    |
| `children`       | `ReactNode`                  | 正常态内容                                      |

## 用法

```tsx
<AsyncBoundary
  loading={list.loading}
  error={list.error}
  isEmpty={list.items.length === 0}
  onRetry={() => void list.reload()}
  retryText={t('common.retry', { defaultValue: 'Retry' })}
  errorContent={t('errors.unknown', { defaultValue: 'Something went wrong' })}
  emptyContent={
    <EmptyState
      icon={<AppIcon name='book' size={48} />}
      title={t('kb.empty', { defaultValue: 'No knowledge base yet' })}
    />
  }
>
  <KnowledgeBaseGrid items={list.items} />
</AsyncBoundary>
```

## 行为约定

- **状态优先级固定**：loading > error > empty > content。同时命中多个状态时只渲染最先的那个，否则会出现「上面报错、下面空列表」的叠层。
- 任一非 content 状态都**不渲染 `children`** —— 旧内容不该在错误提示下面露出来。
- **没有文案就不渲染按钮**：`onRetry` 和 `retryText` 都给了才渲染重试按钮。一个没字的重试按钮比没有更糟。

## 相关

- [EmptyState](empty-state.md) —— `emptyContent` 的默认内容。
