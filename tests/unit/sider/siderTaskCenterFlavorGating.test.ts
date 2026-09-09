import { describe, expect, it } from 'vitest';

describe('flavor config (task-center sidebar gating)', () => {
  it('defaults to enterprise so the task center entry ships by default', async () => {
    const { FLAVOR } = await import('@/common/config/flavor');
    expect(FLAVOR).toBe('enterprise');
  });

  it('accepts only "public" or "enterprise" as a valid value', async () => {
    const flavorModule = await import('@/common/config/flavor');
    // The TypeScript type narrows the union; assert the runtime values it
    // can hold so flipping the constant cannot silently produce an unknown
    // flavor.
    expect(['public', 'enterprise']).toContain(flavorModule.FLAVOR);
  });

  it('exports SiderTaskCenterEntry as the real component when flavor is enterprise', async () => {
    const nav = await import('@renderer/components/layout/Sider/SiderNav');
    const direct = await import('@renderer/components/layout/Sider/SiderNav/SiderTaskCenterEntry');
    expect(nav.SiderTaskCenterEntry).toBe(direct.default);
    expect(nav.SiderTaskCenterEntry).not.toBeNull();
  });
});
