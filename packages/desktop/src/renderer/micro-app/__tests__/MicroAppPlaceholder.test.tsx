import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MicroAppPlaceholder } from '../views/MicroAppPlaceholder';

vi.mock('qiankun', () => ({
  loadMicroApp: vi.fn(() => Promise.resolve({ mount: vi.fn(), unmount: vi.fn(), update: vi.fn() })),
}));

/** MicroAppHost 用 `useNavigate()`,lazy 加载完成后必须有 Router 兜着。 */
const renderPlaceholder = (name: string) =>
  render(
    <MemoryRouter>
      <MicroAppPlaceholder microAppName={name} />
    </MemoryRouter>
  );

describe('MicroAppPlaceholder', () => {
  it('renders container node with correct id', () => {
    const { container } = renderPlaceholder('meeting-recording');
    const node = container.querySelector('#meeting-recording-container');
    expect(node).toBeTruthy();
  });

  it('shows loading state initially', () => {
    const { getByText } = renderPlaceholder('meeting-recording');
    expect(getByText(/loading/i)).toBeTruthy();
  });

  /**
   * 高度链回归测试。
   *
   * 子应用根节点用 `h-full`(height: 100%),而百分比高度要求祖先有确定高度。
   * 这条链上 shell 侧有三层:placeholder 根节点 → 容器 → qiankun 运行时插入的
   * wrapper。任何一层少了高度,子应用就会退化成内容高度(表现:页面只有内容
   * 那么高,下方留白)。
   */
  it('stretches the placeholder root to the full route content height', () => {
    const { container } = renderPlaceholder('notes');
    const root = container.querySelector('.micro-app-placeholder');

    expect(root?.className).toContain('flex');
    expect(root?.className).toContain('flex-col');
    expect(root?.className).toContain('h-full');
    expect(root?.className).toContain('min-h-0');
    // Loading / ErrorFallback 靠 `relative` 父级做绝对定位覆盖
    expect(root?.className).toContain('relative');
  });

  it('stretches the qiankun container and its wrapper', () => {
    const { container } = renderPlaceholder('notes');
    const appContainer = container.querySelector('#notes-container');

    expect(appContainer?.className).toContain('flex-1');
    expect(appContainer?.className).toContain('min-h-0');
    // qiankun 在容器里插入的 wrapper 是 `processTpl` 生成的
    // `<div id="__qiankun_microapp_wrapper_for_<name>__" data-name=...>`,
    // 只有 id、没有 className,样式只能靠子选择器下发。
    // 注意:它**没有** data-qiankun 属性(qiankun 2.x 全仓无此属性)。
    expect(appContainer?.className).toContain('[&>[id*=qiankun]]');
  });

  it('overlays the loading spinner instead of flowing it below the flex-1 container', () => {
    const { container, getByText } = renderPlaceholder('notes');

    // 容器是 flex-1(永久占满高度),Loading 若走正常流会被挤到视口外,
    // 所以它必须绝对定位覆盖整块区域。
    const overlay = container.querySelector('.absolute.inset-0');
    expect(overlay).toBeTruthy();
    expect(overlay?.contains(getByText(/loading/i))).toBe(true);
  });
});
