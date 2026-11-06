/**
 * 活动 props 跟踪
 *
 * `setActiveProps` 由主应用在 micro-app `mount()` 时调用,把当前 props 缓存到
 * 模块级,供异步上下文(例如 fetch 拦截器、401 处理)之后取回。
 *
 * 单一 `currentProps` 即可:qiankun 同一时刻只会激活一个子应用实例,重入
 * `mount` 时 `setActiveProps` 会原子覆盖。`unmount` 时调用 `clearActiveProps`
 * 防止闭包持有过期引用。
 */
import type { MicroAppProps } from './types';

let currentProps: MicroAppProps | null = null;

export function setActiveProps(props: MicroAppProps): void {
  currentProps = props;
}

export function emitAuthExpired(reason: string = 'token_invalid'): void {
  currentProps?.emit('auth:expired', { reason });
}

export function clearActiveProps(): void {
  currentProps = null;
}
