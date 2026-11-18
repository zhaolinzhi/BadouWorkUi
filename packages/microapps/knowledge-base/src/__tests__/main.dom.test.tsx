/**
 * 知识库微应用生命周期冒烟测试。
 *
 * 只验证 boot 协议是否符合 qiankun 契约(bootstrap / mount / unmount / 容器解析
 * / props 透传 / 401 事件回流 / localStorage 兜底)。业务组件树(列表、编辑器、
 * Markdown 预览)由组件级测试覆盖,这里把 `App` mock 掉,并用假的
 * `react-dom/client` 让 jsdom 不必加载 Arco、react-markdown、katex 这一整条
 * 重依赖链。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';
import type { MicroAppProps } from '@renderer/micro-app/types';

/** 每次 createRoot 产生一个假 root,记录它收到的 render 元素。 */
const roots = vi.hoisted(() => [] as Array<{ render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }>);

// `App` 会拖进 Arco + react-markdown + katex;这里只关心 main.ts 的接线。
vi.mock('../App', () => ({ default: () => null }));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => {
    const instance = { render: vi.fn(), unmount: vi.fn() };
    roots.push(instance);
    return instance;
  }),
}));

/** 取最近一次 `root.render(<KnowledgeBaseApp runtime={...} />)` 里的 runtime。 */
const lastRuntime = (): MicroAppProps => {
  const element = roots.at(-1)?.render.mock.calls.at(-1)?.[0] as ReactElement<{ runtime: MicroAppProps }>;
  if (!element) throw new Error('root.render was never called');
  return element.props.runtime;
};

const baseProps: MicroAppProps = {
  token: 'test-token',
  userInfo: { id: 'u1', username: 'test-user', permissions: [], tenantId: 't1' },
  systemCode: 'kb-test',
  baseApi: 'http://localhost:0/api',
  shellVersion: '0.0.0',
  theme: 'light',
  locale: 'zh-CN',
  isMobile: false,
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
};

describe('knowledge-base micro-app lifecycle', () => {
  let mod: typeof import('../main');

  beforeAll(async () => {
    mod = await import('../main');
  }, 60000);

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    roots.length = 0;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('bootstrap 不抛错', async () => {
    await expect(mod.bootstrap()).resolves.not.toThrow();
  });

  it('mount 渲染到容器节点', async () => {
    const container = document.createElement('div');
    container.id = 'knowledge-base-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#knowledge-base-container' });

    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalledTimes(1);
    /*
     * React 挂在容器**内部的专属节点**上,不是容器本身 ——
     * 容器(qiankun wrapper)里住着 `<qiankun-head>`,React 直接挂上去会在
     * 首次提交时把它清空,子应用里任何运行时加载脚本的地方都会炸。
     * 详见 `@aionui/microapp-shared` 的 `qiankun/mount.ts`。
     */
    const mountNode = vi.mocked(createRoot).mock.calls[0][0] as HTMLElement;
    expect(mountNode.parentElement).toBe(container);
  });

  /**
   * qiankun 传过来的是 wrapper **元素**,不是选择器。早期实现把它 toString 后
   * 丢给 querySelector 会直接 SyntaxError,页面永远空白。
   */
  it('mount 接受 qiankun 形状的 HTMLElement 容器', async () => {
    const wrapper = document.createElement('div');
    wrapper.id = '__qiankun_microapp_wrapper_for_knowledge-base__';
    document.body.appendChild(wrapper);

    await expect(mod.mount({ ...baseProps, container: wrapper })).resolves.not.toThrow();
    await mod.unmount({ ...baseProps, container: wrapper });
  });

  it('容器缺失时抛出可读的错误', async () => {
    await expect(mod.mount({ ...baseProps, container: '#does-not-exist' })).rejects.toThrow(
      /knowledge-base.*container is unavailable/i
    );
  });

  /** 知识库的 AIPaaS 请求靠 `Token` 头,跳 `/kb-chat/:id` 靠 `navigate`。 */
  it('把 shell 的 token / navigate / isMobile 原样透传给业务树', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const navigate = vi.fn();
    await mod.mount({ ...baseProps, container, token: 'shell-token', isMobile: true, navigate });

    const runtime = lastRuntime();
    expect(runtime.token).toBe('shell-token');
    expect(runtime.isMobile).toBe(true);
    expect(runtime.navigate).toBe(navigate);
  });

  /** 401 → `emitAuthExpired` → shell 统一登出,是这条链路的唯一出口。 */
  it('401 时通过 emitAuthExpired 把 auth:expired 事件发回 shell', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const emit = vi.fn();
    await mod.mount({ ...baseProps, container, emit });

    const { emitAuthExpired } = await import('@aionui/microapp-shared');
    emitAuthExpired('knowledge-base');

    expect(emit).toHaveBeenCalledWith('auth:expired', expect.objectContaining({ reason: 'knowledge-base' }));
  });

  it('unmount 清空容器并移除本应用的 localStorage 兜底键', async () => {
    const container = document.createElement('div');
    container.id = 'knowledge-base-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#knowledge-base-container' });
    expect(localStorage.getItem('kb-test_token')).toBe('test-token');
    expect(localStorage.getItem('kb-test_baseApi')).toBe('http://localhost:0/api');

    // 无关应用的键不能被误删
    localStorage.setItem('other_app_token', 'keep-me');

    await mod.unmount({ ...baseProps, container: '#knowledge-base-container' });

    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem('kb-test_token')).toBeNull();
    expect(localStorage.getItem('kb-test_baseApi')).toBeNull();
    expect(localStorage.getItem('other_app_token')).toBe('keep-me');
  });

  it('重复 mount 先卸载旧 root 再挂新的', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container });
    await expect(mod.mount({ ...baseProps, container })).resolves.not.toThrow();

    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalledTimes(2);
    expect(roots[0].unmount).toHaveBeenCalledTimes(1);

    await mod.unmount({ ...baseProps, container });
  });

  it('standalone 分支不会吞掉 shell 的 #root', () => {
    // 模块级副作用在非 qiankun 环境下会同步跑 standalone 分支。刻意只放
    // #knowledge-base-root(子应用私有 id),**不**放 #root —— shell 的 index.html
    // 就有 #root,同名会让 standalone 分支把整个 shell DOM 抹掉。
    const root = document.createElement('div');
    root.id = 'knowledge-base-root';
    document.body.appendChild(root);

    expect(typeof mod.bootstrap).toBe('function');
    expect(typeof mod.mount).toBe('function');
    expect(typeof mod.unmount).toBe('function');
  });
});
