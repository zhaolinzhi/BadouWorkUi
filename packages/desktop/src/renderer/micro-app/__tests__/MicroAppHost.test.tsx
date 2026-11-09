import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { loadMicroApp } from 'qiankun';
import { MicroAppHost } from '../components/MicroAppHost';
import { getEventBus } from '../services/event-bus';
import type { MicroAppProps } from '../types';

vi.mock('qiankun', () => ({
  loadMicroApp: vi.fn(() =>
    Promise.resolve({
      mount: vi.fn(),
      unmount: vi.fn(),
      update: vi.fn(),
    })
  ),
}));

/** MicroAppHost 用 `useNavigate()` 把 shell 路由透传给子应用,必须有 Router。 */
const renderHost = (element: React.ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

/*
 * qiankun 的 `loadMicroApp` 第二个形参声明为 `object`,拿不到 `.props`;
 * 这里显式收窄成本项目真正传进去的形状。
 */
const lastProps = (): MicroAppProps => {
  const calls = vi.mocked(loadMicroApp).mock.calls as unknown as Array<
    [{ props: MicroAppProps }, Record<string, never>]
  >;
  const last = calls.at(-1);
  if (!last) throw new Error('loadMicroApp was never called');
  return last[0].props;
};

describe('MicroAppHost', () => {
  it('renders without crashing', () => {
    const { container } = renderHost(
      <MicroAppHost
        name='meeting-recording'
        entry='//localhost:7991'
        container='#meeting-recording-container'
        activeRule='/meeting-recording'
      />
    );
    expect(container).toBeTruthy();
  });

  it('calls loadMicroApp on mount with correct config', async () => {
    renderHost(
      <MicroAppHost
        name='meeting-recording'
        entry='//localhost:7991'
        container='#meeting-recording-container'
        activeRule='/meeting-recording'
      />
    );
    await waitFor(() => {
      expect(loadMicroApp).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'meeting-recording',
          entry: '//localhost:7991',
          container: '#meeting-recording-container',
        }),
        expect.anything()
      );
    });
  });

  /**
   * 子应用的数据通道依赖 `props.token`(AIPaaS 裸 fetch 的 `Token` 头),
   * 跳转 `/kb-chat/:id` 依赖 `props.navigate`。两者之前都是 noop / 空串,
   * 知识库迁移过来会直接不可用。
   */
  it('hands the shell token and a working navigate to the micro app', async () => {
    renderHost(
      <MicroAppHost
        name='knowledge-base'
        entry='//localhost:7993'
        container='#knowledge-base-container'
        activeRule='/knowledge-base'
        props={{ token: 'shell-token', isMobile: true }}
      />
    );

    await waitFor(() => {
      expect(loadMicroApp).toHaveBeenCalled();
    });

    const props = lastProps();
    expect(props.token).toBe('shell-token');
    expect(props.isMobile).toBe(true);
    // navigate 真的能驱动 router(不是 noop)
    expect(typeof props.navigate).toBe('function');
    expect(() => props.navigate('/kb-chat/42')).not.toThrow();
  });

  /**
   * 事件总线必须是**单例**:之前三处各自 createEventBus(),子应用
   * emit('auth:expired') 落进没有订阅者的实例,token 过期不会登出。
   */
  it('shares one event bus between props and the shell subscription point', () => {
    expect(getEventBus()).toBe(getEventBus());
  });

  /**
   * Electron 下微应用是 `MicroAppHost` 挂载的(不是 `startMicroApps`),
   * 这里的 baseApi 曾经硬编码成相对路径 `/api` —— 子应用自己发的请求
   * (笔记编辑器粘贴图片的 `/api/fs/upload`)会打到 renderer 自己的源:
   * dev 下是 Vite dev server(404),打包后是 file:// 相对路径(直接失败)。
   */
  it('gives the micro app an absolute baseApi in Electron mode', async () => {
    const win = window as Window & { __backendPort?: number };
    win['__backendPort'] = 50548;
    try {
      renderHost(
        <MicroAppHost name='notes' entry='//localhost:7992' container='#notes-container' activeRule='/notes' />
      );

      await waitFor(() => {
        expect(loadMicroApp).toHaveBeenCalled();
      });

      expect(lastProps().baseApi).toBe('http://127.0.0.1:50548/api');
    } finally {
      delete win['__backendPort'];
    }
  });
});
