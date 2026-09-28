import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// One stable temp dir for the whole suite; cleared between tests so the
// service starts each `it` from an empty <userData>/meeting-recordings/ tree.
// (vi.mock('electron') factories are only invoked once per test file — using a
// fresh dir per test via the factory is not possible.)
const userDataDir = path.join(
  os.tmpdir(),
  `aionui-mr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`);
      return userDataDir;
    },
  },
}));

import { createMeetingRecordingService } from '../../../packages/desktop/src/process/services/meetingRecording';
import type { SaveRecordingParams } from '../../../packages/desktop/src/common/types/meetingRecording';

beforeEach(async () => {
  await fs.mkdir(userDataDir, { recursive: true });
  // Remove any previous recordings from prior tests in this file.
  const recordingsDir = path.join(userDataDir, 'meeting-recordings');
  await fs.rm(recordingsDir, { recursive: true, force: true });
});

afterEach(async () => {
  // Leave the parent dir; subsequent tests clean via beforeEach.
});

describe('meetingRecordingService', () => {
  it('saves a recording under <id>/audio.<ext> + meta.json', async () => {
    const svc = createMeetingRecordingService();
    const params: SaveRecordingParams = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Recording 2026-09-28',
      mimeType: 'audio/webm;codecs=opus',
      durationMs: 1234,
      audioBase64: Buffer.from('fake-audio').toString('base64'),
    };
    const result = await svc.save(params);

    expect(result.id).toBe(params.id);
    expect(result.mimeType).toBe(params.mimeType);
    expect(result.durationMs).toBe(1234);
    expect(result.audioUrl.endsWith('audio.webm')).toBe(true);
    expect(result.transcription).toBe('');

    const dir = path.dirname(result.audioUrl);
    const written = await fs.readFile(result.audioUrl);
    expect(written.toString('utf8')).toBe('fake-audio');
    const metaRaw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8');
    const meta = JSON.parse(metaRaw);
    expect(meta.id).toBe(params.id);
    expect(meta.createdAt).toBeGreaterThan(0);
  });

  it('lists recordings sorted by createdAt desc, skipping invalid entries', async () => {
    const svc = createMeetingRecordingService();
    const base = {
      name: 'r',
      mimeType: 'audio/webm',
      durationMs: 1,
      audioBase64: Buffer.from('x').toString('base64'),
    };
    const older = await svc.save({ ...base, id: '11111111-1111-1111-1111-111111111111' });
    await new Promise((r) => setTimeout(r, 5));
    const newer = await svc.save({ ...base, id: '22222222-2222-2222-2222-222222222222' });

    // Corrupt one meta.json; list() must skip it, not throw.
    await fs.writeFile(path.join(path.dirname(older.audioUrl), 'meta.json'), 'not-json');

    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(newer.id);
  });

  it('deletes a recording folder', async () => {
    const svc = createMeetingRecordingService();
    const params: SaveRecordingParams = {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'r',
      mimeType: 'audio/webm',
      durationMs: 1,
      audioBase64: Buffer.from('x').toString('base64'),
    };
    const saved = await svc.save(params);
    expect((await fs.stat(path.dirname(saved.audioUrl))).isDirectory()).toBe(true);

    await svc.delete(params.id);
    await expect(fs.stat(path.dirname(saved.audioUrl))).rejects.toThrow();
  });

  it('writes a placeholder transcription on transcribe()', async () => {
    const svc = createMeetingRecordingService();
    const params: SaveRecordingParams = {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'My Meeting',
      mimeType: 'audio/webm',
      durationMs: 1,
      audioBase64: Buffer.from('x').toString('base64'),
    };
    await svc.save(params);
    const { id, transcription } = await svc.transcribe(params.id);
    expect(id).toBe(params.id);
    expect(transcription).toContain('My Meeting');
  });

  it('rejects ids that are not uuid-shaped', async () => {
    const svc = createMeetingRecordingService();
    await expect(svc.delete('../escape')).rejects.toThrow(/uuid/i);
  });
});
