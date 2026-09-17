import { describe, expect, it } from 'vitest';

describe('flavor config (task-center sidebar gating)', () => {
  it('is set to either "public" or "enterprise"', async () => {
    const flavorModule = await import('@/common/config/flavor');
    // The TypeScript type narrows the union; assert the runtime values it
    // can hold so flipping the constant cannot silently produce an unknown
    // flavor.
    expect(['public', 'enterprise']).toContain(flavorModule.FLAVOR);
  });

  it('gates SiderTaskCenterEntry based on FLAVOR', async () => {
    const flavorModule = await import('@/common/config/flavor');
    const nav = await import('@renderer/components/layout/Sider/SiderNav');
    const direct = await import('@renderer/components/layout/Sider/SiderNav/SiderTaskCenterEntry');

    if (flavorModule.FLAVOR === 'public') {
      // Public flavor: entry is null so the UI skips it; the page and IPC
      // code stay in the bundle for internal references.
      expect(nav.SiderTaskCenterEntry).toBeNull();
    } else {
      // Enterprise flavor: entry is the real component.
      expect(nav.SiderTaskCenterEntry).toBe(direct.default);
      expect(nav.SiderTaskCenterEntry).not.toBeNull();
    }
  });
});
