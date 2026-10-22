import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getMicroAppConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns default config when no env override', async () => {
    vi.stubEnv('VITE_MEETING_RECORDING_APP_ENTRY', '');
    const { getMicroAppConfig, MICRO_APP_DEFAULTS } = await import('../config/micro-apps');
    expect(MICRO_APP_DEFAULTS['meeting-recording']).toBeDefined();
    const config = getMicroAppConfig('meeting-recording');
    expect(config.name).toBe('meeting-recording');
    expect(config.activeRule).toBe('/meeting-recording');
    expect(config.container).toBe('#meeting-recording-container');
    expect(config.entry).toContain('7991');
  });

  it('uses env override for entry', async () => {
    vi.stubEnv('VITE_MEETING_RECORDING_APP_ENTRY', 'https://prod.example.com/meeting-recording');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    const config = getMicroAppConfig('meeting-recording');
    expect(config.entry).toBe('https://prod.example.com/meeting-recording');
  });

  it('throws for unknown micro app', async () => {
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(() => getMicroAppConfig('non-existent')).toThrow(/Unknown micro app/);
  });
});

describe('getMicroAppConfig asset base', () => {
  beforeEach(() => {
    vi.resetModules();
    // 每个用例都要显式清掉单应用 env，否则会盖住 asset base，测的就不是这一层了。
    // Clear the per-app vars explicitly, otherwise they mask the asset base and the case
    // stops testing what it means to test.
    vi.stubEnv('VITE_MEETING_RECORDING_APP_ENTRY', '');
    vi.stubEnv('VITE_NOTES_APP_ENTRY', '');
    vi.stubEnv('VITE_KNOWLEDGE_BASE_APP_ENTRY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds an app:// entry when bundled into the installer', async () => {
    vi.stubEnv('VITE_MICRO_APP_ASSET_BASE', 'app://microapps');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(getMicroAppConfig('notes').entry).toBe('app://microapps/notes/index.html');
    expect(getMicroAppConfig('knowledge-base').entry).toBe('app://microapps/knowledge-base/index.html');
  });

  it('builds a CDN entry for standalone deployment', async () => {
    vi.stubEnv('VITE_MICRO_APP_ASSET_BASE', 'https://cdn.example.com/microapps');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(getMicroAppConfig('notes').entry).toBe('https://cdn.example.com/microapps/notes/index.html');
  });

  it('tolerates a trailing slash on the base', async () => {
    vi.stubEnv('VITE_MICRO_APP_ASSET_BASE', 'https://cdn.example.com/microapps/');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(getMicroAppConfig('notes').entry).toBe('https://cdn.example.com/microapps/notes/index.html');
  });

  it('keeps the per-app entry ahead of the asset base', async () => {
    vi.stubEnv('VITE_MICRO_APP_ASSET_BASE', 'app://microapps');
    vi.stubEnv('VITE_NOTES_APP_ENTRY', 'https://cdn.example.com/override/index.html');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(getMicroAppConfig('notes').entry).toBe('https://cdn.example.com/override/index.html');
    // 没被 override 的子应用仍然走 asset base。
    expect(getMicroAppConfig('knowledge-base').entry).toBe('app://microapps/knowledge-base/index.html');
  });

  it('falls back to the dev port when the asset base is unset', async () => {
    vi.stubEnv('VITE_MICRO_APP_ASSET_BASE', '');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    expect(getMicroAppConfig('notes').entry).toBe('//localhost:7992');
  });
});

describe('MICRO_APP_DEFAULTS.notes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exists in defaults', async () => {
    vi.stubEnv('VITE_NOTES_APP_ENTRY', '');
    const { MICRO_APP_DEFAULTS } = await import('../config/micro-apps');
    expect(MICRO_APP_DEFAULTS.notes).toBeDefined();
  });

  it('has correct name / activeRule / container', async () => {
    vi.stubEnv('VITE_NOTES_APP_ENTRY', '');
    const { MICRO_APP_DEFAULTS } = await import('../config/micro-apps');
    expect(MICRO_APP_DEFAULTS.notes.name).toBe('notes');
    expect(MICRO_APP_DEFAULTS.notes.activeRule).toBe('/notes');
    expect(MICRO_APP_DEFAULTS.notes.container).toBe('#notes-container');
  });

  it('uses dev entry port 7992 when env override is empty', async () => {
    vi.stubEnv('VITE_NOTES_APP_ENTRY', '');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    const config = getMicroAppConfig('notes');
    expect(config.entry).toBe('//localhost:7992');
  });

  it('respects VITE_NOTES_APP_ENTRY env override for entry', async () => {
    vi.stubEnv('VITE_NOTES_APP_ENTRY', 'https://prod.example.com/notes');
    const { getMicroAppConfig } = await import('../config/micro-apps');
    const config = getMicroAppConfig('notes');
    expect(config.entry).toBe('https://prod.example.com/notes');
  });
});
