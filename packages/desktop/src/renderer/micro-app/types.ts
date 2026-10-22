/**
 * 注入到子应用的运行时 props。
 * 详细协议见 docs/superpowers/specs/2026-10-13-aionui-qiankun-shell-design.md 第 4.1 节
 */

export interface MicroAppUserInfo {
  id: string;
  username: string;
  avatar?: string;
  permissions: string[];
  tenantId: string;
}

export interface MicroAppProps {
  // 用户态
  token: string;
  userInfo: MicroAppUserInfo;

  // 运行时配置
  systemCode: string;
  baseApi: string;
  shellVersion: string;
  theme: 'light' | 'dark';
  locale: string;
  /**
   * shell 的视口判定结果。
   *
   * shell 的 `LayoutContext.isMobile` 是 React Context,微应用在 qiankun 沙箱里
   * 拿不到那个 Provider。知识库等需要响应式布局的子应用依赖这个判定,
   * 所以由 shell 在 mount 时快照一份传进来。
   *
   * 注意这是**挂载时刻的快照**,不是实时值 —— 窗口尺寸变化后子应用需要自行
   * 监听 resize(shell 的判定逻辑本身也只在挂载/ resize 时更新)。
   */
  isMobile: boolean;

  // 跨应用事件总线
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  emit: (event: string, payload: unknown) => void;

  // 导航 API
  navigate: (path: string) => void;
  navigateExternal: (path: string) => void;
}

/**
 * 子应用注册表条目。
 * activeRule 来自后端菜单（不写死）。
 */
export interface MicroAppConfig {
  name: string;
  activeRule: string;
  container: `#${string}`;
  entry: string;
}
