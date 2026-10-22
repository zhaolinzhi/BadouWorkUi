/**
 * 镜像 MicroAppProps 到 localStorage 兜底
 *
 * `createAppContext` 把 props 写到 `${systemCode}_token` / `_userInfo` / `_baseApi`
 * 三个 key,作为离线 / 降级场景下子应用取回自己会话的兜底通道。
 *
 * 空 token / 空 username 时不写对应 key — 避免把"未登录"状态污染给后续 mount。
 * `baseApi` 总是写,因为它每次 mount 都可能换(切换 shell 部署环境)。
 */
import type { MicroAppProps } from './types';

export function createAppContext(props: MicroAppProps): MicroAppProps {
  if (props.token) {
    localStorage.setItem(`${props.systemCode}_token`, props.token);
  }
  if (props.userInfo.username) {
    localStorage.setItem(`${props.systemCode}_userInfo`, JSON.stringify(props.userInfo));
  }
  localStorage.setItem(`${props.systemCode}_baseApi`, props.baseApi);

  return props;
}
