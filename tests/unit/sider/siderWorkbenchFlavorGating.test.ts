import { describe, expect, it } from 'vitest';

describe('flavor config (workbench sidebar gating)', () => {
  it('is set to either "public" or "enterprise"', async () => {
    const flavorModule = await import('@/common/config/flavor');
    // The TypeScript type narrows the union; assert the runtime values it
    // can hold so flipping the constant cannot silently produce an unknown
    // flavor.
    expect(['public', 'enterprise']).toContain(flavorModule.FLAVOR);
  });

  it('gates SiderWorkbenchEntry based on FLAVOR', async () => {
    const flavorModule = await import('@/common/config/flavor');
    const nav = await import('@renderer/components/layout/Sider/SiderNav');
    const direct = await import('@renderer/components/layout/Sider/SiderNav/SiderWorkbenchEntry');

    if (flavorModule.FLAVOR === 'public') {
      // Public flavor: entry is null so the UI skips it; the page and IPC
      // code stay in the bundle for internal references.
      expect(nav.SiderWorkbenchEntry).toBeNull();
    } else {
      // Enterprise flavor: entry is the real component.
      expect(nav.SiderWorkbenchEntry).toBe(direct.default);
      expect(nav.SiderWorkbenchEntry).not.toBeNull();
    }
  });
});
