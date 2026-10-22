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
