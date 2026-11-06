import { describe, it, expect, vi } from 'vitest';

// 在所有 import 之前 stub env（vitest 模块单例，env 在首次求值时固定）
vi.hoisted(() => {
  vi.stubEnv('VITE_MICRO_APP_ENABLED', 'true');
});

vi.mock('qiankun', () => ({
  registerMicroApps: vi.fn(),
  start: vi.fn(),
  loadMicroApp: vi.fn(),
}));

vi.mock('@/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    userInfo: { id: 'u1', username: 'tester', permissions: [] as string[], tenantId: 't1' },
    theme: 'light',
    locale: 'zh-CN',
  }),
}));

// Stub getBaseUrl so micro-apps sees the same-origin / WebUI case (baseApi='/api').
// In node test env, `window` is undefined, so httpBridge.getBaseUrl() would
// otherwise return the Electron fallback `http://127.0.0.1:13400` — that
// matches production Electron dev, but is not what these unit tests assert.
vi.mock('@/common/adapter/httpBridge', () => ({
  getBaseUrl: () => '',
}));

describe('isMicroAppEnabled', () => {
  it('returns true when VITE_MICRO_APP_ENABLED=true (default in test)', async () => {
    const { isMicroAppEnabled } = await import('../services/micro-apps');
    expect(isMicroAppEnabled()).toBe(true);
  });

  it('returns false when VITE_MICRO_APP_ENABLED is empty (reset modules)', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_MICRO_APP_ENABLED', '');
    const { isMicroAppEnabled } = await import('../services/micro-apps');
    expect(isMicroAppEnabled()).toBe(false);
  });
});

describe('buildMicroAppProps', () => {
  it('includes required config fields', async () => {
    const { buildMicroAppProps } = await import('../services/micro-apps');
    const props = buildMicroAppProps({
      navigate: vi.fn(),
      navigateExternal: vi.fn(),
      on: vi.fn(() => () => {}),
      emit: vi.fn(),
    });
    expect(props.systemCode).toBe('aionui');
    // baseApi is composed from getBaseUrl() + '/api'. In test (no __backendPort)
    // getBaseUrl() returns '' (same-origin / WebUI mode), so we expect '/api'.
    expect(props.baseApi).toBe('/api');
    expect(props.shellVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(props.theme).toBe('light');
    expect(props.locale).toBe('zh-CN');
  });
});

describe('startMicroApps', () => {
  it('registers meeting-recording with correct config', async () => {
    // vi.hoisted 只在 file 加载时执行一次，per-test env 已被 reset；这里重新 stub
    vi.stubEnv('VITE_MICRO_APP_ENABLED', 'true');
    const { registerMicroApps } = await import('qiankun');
    const { startMicroApps } = await import('../services/micro-apps');
    vi.mocked(registerMicroApps).mockClear();
    // 必须 await:startMicroApps 里 `await import('qiankun')` 会让出微任务,
    // 不等的话 registerMicroApps 还没被调用就断言了。
    await startMicroApps({
      navigate: vi.fn(),
      navigateExternal: vi.fn(),
      on: vi.fn(() => () => {}),
      emit: vi.fn(),
    });
    expect(registerMicroApps).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'meeting-recording' })]),
      expect.any(Function)
    );
  });
});
