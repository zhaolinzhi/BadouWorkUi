# cx

极简 className 拼接。共享层不引 `classnames` —— 多一个依赖就多一份版本对齐负担。

- 源码：[packages/ui/src/utils/cx.ts](../../../packages/ui/src/utils/cx.ts)

## 用法

```ts
import { cx } from '@aionui/ui';

cx('flex items-center', isActive && 'text-t-primary', className);
// → 'flex items-center text-t-primary <你的 class>'
```

## 行为约定

- 只拼接**真值**参数：`false` / `undefined` / `null` / `''` 会被跳过。
- 接收任意多个参数，不需要包一层数组。
