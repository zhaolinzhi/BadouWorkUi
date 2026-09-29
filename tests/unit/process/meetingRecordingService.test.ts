import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Mock sttClient so service tests don't hit the real endpoint.
vi.mock('../../../packages/desktop/src/process/services/meetingRecording/sttClient', () => ({
  transcribeFile: vi.fn(),
}));

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

// Mock ipcBridge so chunkTranscribed.emit doesn't blow up.
vi.mock('@/common', () => ({
  ipcBridge: {
    meetingRecording: {
      chunkTranscribed: { emit: vi.fn() },
    },
  },
}));

import { transcribeFile } from '../../../packages/desktop/src/process/services/meetingRecording/sttClient';
import { createMeetingRecordingService } from '../../../packages/desktop/src/process/services/meetingRecording';
import { ipcBridge } from '../../../packages/desktop/src/common';
import type { SaveRecordingParams } from '../../../packages/desktop/src/common/types/meetingRecording';

beforeEach(async () => {
  await fs.mkdir(userDataDir, { recursive: true });
  await fs.rm(path.join(userDataDir, 'meeting-recordings'), {
    recursive: true,
    force: true,
  });
  vi.mocked(transcribeFile).mockReset();
  vi.mocked(ipcBridge.meetingRecording.chunkTranscribed.emit).mockClear();
});

afterEach(async () => {
  // Leave parent dir; beforeEach cleans recordings.
});

describe('meetingRecordingService (chunked)', () => {
  it('saves N chunks under <id>/chunks/<index>.webm + meta.json', async () => {
    const svc = createMeetingRecordingService();
    const params: SaveRecordingParams = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'r',
      mimeType: 'audio/webm',
      chunks: [
        { index: 0, durationMs: 30000, audioBase64: Buffer.from('a').toString('base64') },
        { index: 1, durationMs: 25000, audioBase64: Buffer.from('b').toString('base64') },
      ],
    };
    const result = await svc.save(params);

    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].audioUrl.endsWith('chunks/000.webm')).toBe(true);
    expect(result.chunks[1].audioUrl.endsWith('chunks/001.webm')).toBe(true);
    expect(result.durationMs).toBe(55000);

    expect(await fs.readFile(result.chunks[0].audioUrl, 'utf8')).toBe('a');
    expect(await fs.readFile(result.chunks[1].audioUrl, 'utf8')).toBe('b');
    const metaRaw = await fs.readFile(path.join(userDataDir, 'meeting-recordings', params.id, 'meta.json'), 'utf8');
    const parsed = JSON.parse(metaRaw);
    expect(parsed.chunks.map((c: { status: string }) => c.status)).toEqual(['pending', 'pending']);
  });

  it('transcribe() walks chunks serially, updates status, emits per chunk', async () => {
    const svc = createMeetingRecordingService();
    const id = '22222222-2222-2222-2222-222222222222';
    await svc.save({
      id,
      name: 'r',
      mimeType: 'audio/webm',
      chunks: [
        { index: 0, durationMs: 1000, audioBase64: Buffer.from('a').toString('base64') },
        { index: 1, durationMs: 1000, audioBase64: Buffer.from('b').toString('base64') },
      ],
    });

    vi.mocked(transcribeFile)
      .mockResolvedValueOnce({ ok: true, text: '你好' })
      .mockResolvedValueOnce({ ok: false, error: 'HTTP 500' });

    // Fire-and-forget; wait a tick for the background walk to complete.
    await svc.transcribe(id);
    await new Promise((r) => setTimeout(r, 50));

    const meta = JSON.parse(await fs.readFile(path.join(userDataDir, 'meeting-recordings', id, 'meta.json'), 'utf8'));
    expect(meta.chunks[0]).toMatchObject({ status: 'transcribed', transcription: '你好' });
    expect(meta.chunks[1]).toMatchObject({ status: 'failed', transcription: '', error: 'HTTP 500' });

    const emit = vi.mocked(ipcBridge.meetingRecording.chunkTranscribed.emit);
    expect(emit).toHaveBeenCalledWith({ id, chunkIndex: 0, status: 'transcribed', error: undefined });
    expect(emit).toHaveBeenCalledWith({ id, chunkIndex: 1, status: 'failed', error: 'HTTP 500' });
  });

  it('list() returns recordings with chunks[] preserved', async () => {
    const svc = createMeetingRecordingService();
    await svc.save({
      id: '33333333-3333-3333-3333-333333333333',
      name: 'r',
      mimeType: 'audio/webm',
      chunks: [{ index: 0, durationMs: 1, audioBase64: Buffer.from('a').toString('base64') }],
    });
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0].chunks).toHaveLength(1);
    expect(list[0].chunks[0].status).toBe('pending');
  });

  it('delete() removes the chunks folder', async () => {
    const svc = createMeetingRecordingService();
    const id = '44444444-4444-4444-4444-444444444444';
    await svc.save({
      id,
      name: 'r',
      mimeType: 'audio/webm',
      chunks: [{ index: 0, durationMs: 1, audioBase64: Buffer.from('a').toString('base64') }],
    });
    await svc.delete(id);
    await expect(fs.stat(path.join(userDataDir, 'meeting-recordings', id))).rejects.toThrow();
  });

  it('rejects ids that are not uuid-shaped', async () => {
    const svc = createMeetingRecordingService();
    await expect(svc.delete('../escape')).rejects.toThrow(/uuid/i);
  });
});
