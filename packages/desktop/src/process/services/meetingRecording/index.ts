/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { MeetingRecording, SaveRecordingParams } from '@/common/types/meetingRecording';

const RECORDINGS_ROOT = (): string => path.join(app.getPath('userData'), 'meeting-recordings');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assertUuid = (id: string): void => {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid recording id (expected uuid): ${id}`);
  }
};

const mimeToExt = (mimeType: string): string => {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'bin';
};

const readMeta = async (dir: string): Promise<Omit<MeetingRecording, 'audioUrl'> | null> => {
  try {
    const raw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8');
    return JSON.parse(raw) as Omit<MeetingRecording, 'audioUrl'>;
  } catch {
    return null;
  }
};

export const createMeetingRecordingService = () => ({
  async list(): Promise<MeetingRecording[]> {
    const root = RECORDINGS_ROOT();
    let entries: string[] = [];
    try {
      entries = await fs.readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const results: MeetingRecording[] = [];
    for (const id of entries) {
      const dir = path.join(root, id);
      const stat = await fs.stat(dir).catch((): null => null);
      if (!stat?.isDirectory()) continue;
      const meta = await readMeta(dir);
      if (!meta) continue;
      const audioPath = path.join(dir, `audio.${mimeToExt(meta.mimeType)}`);
      results.push({ ...meta, audioUrl: audioPath });
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },

  async save(p: SaveRecordingParams): Promise<MeetingRecording> {
    assertUuid(p.id);
    const dir = path.join(RECORDINGS_ROOT(), p.id);
    await fs.mkdir(dir, { recursive: true });
    const ext = mimeToExt(p.mimeType);
    const audioPath = path.join(dir, `audio.${ext}`);
    await fs.writeFile(audioPath, Buffer.from(p.audioBase64, 'base64'));
    const meta: Omit<MeetingRecording, 'audioUrl'> = {
      id: p.id,
      name: p.name,
      createdAt: Date.now(),
      durationMs: p.durationMs,
      mimeType: p.mimeType,
      transcription: '',
    };
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
    return { ...meta, audioUrl: audioPath };
  },

  async delete(id: string): Promise<{ ok: true }> {
    assertUuid(id);
    const dir = path.join(RECORDINGS_ROOT(), id);
    await fs.rm(dir, { recursive: true, force: true });
    return { ok: true };
  },

  async transcribe(id: string): Promise<{ id: string; transcription: string }> {
    assertUuid(id);
    const dir = path.join(RECORDINGS_ROOT(), id);
    const meta = await readMeta(dir);
    if (!meta) throw new Error(`Recording not found: ${id}`);
    const transcription = `[Placeholder transcription for ${meta.name}]`;
    await fs.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify({ ...meta, transcription }, null, 2)
    );
    return { id, transcription };
  },
});