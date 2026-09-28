/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { ipcBridge } from '@/common';
import type {
  MeetingRecording,
  RecordingChunk,
  SaveRecordingParams,
} from '@/common/types/meetingRecording';
import { transcribeFile } from './sttClient';

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

const readMeta = async (dir: string): Promise<MeetingRecording | null> => {
  try {
    const raw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8');
    return JSON.parse(raw) as MeetingRecording;
  } catch {
    return null;
  }
};

const writeMeta = async (dir: string, meta: MeetingRecording): Promise<void> => {
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
};

const emitChunkTranscribed = (
  id: string,
  chunkIndex: number,
  status: 'transcribed' | 'failed'
): void => {
  ipcBridge.meetingRecording.chunkTranscribed.emit({ id, chunkIndex, status });
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
      results.push(meta);
    }
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },

  async save(p: SaveRecordingParams): Promise<MeetingRecording> {
    assertUuid(p.id);
    const dir = path.join(RECORDINGS_ROOT(), p.id);
    await fs.mkdir(dir, { recursive: true });
    const chunksDir = path.join(dir, 'chunks');
    await fs.mkdir(chunksDir, { recursive: true });

    const ext = mimeToExt(p.mimeType);
    const chunks: RecordingChunk[] = [];
    for (const c of p.chunks) {
      const audioPath = path.join(chunksDir, `${String(c.index).padStart(3, '0')}.${ext}`);
      await fs.writeFile(audioPath, Buffer.from(c.audioBase64, 'base64'));
      chunks.push({
        index: c.index,
        durationMs: c.durationMs,
        audioUrl: audioPath,
        transcription: '',
        status: 'pending',
      });
    }

    const totalDuration = chunks.reduce((sum, c) => sum + c.durationMs, 0);
    const meta: MeetingRecording = {
      id: p.id,
      name: p.name,
      createdAt: Date.now(),
      mimeType: p.mimeType,
      durationMs: totalDuration,
      chunks,
    };
    await writeMeta(dir, meta);
    return meta;
  },

  async delete(id: string): Promise<{ ok: true }> {
    assertUuid(id);
    const dir = path.join(RECORDINGS_ROOT(), id);
    await fs.rm(dir, { recursive: true, force: true });
    return { ok: true };
  },

  async transcribe(id: string): Promise<{ id: string }> {
    assertUuid(id);
    const dir = path.join(RECORDINGS_ROOT(), id);
    const meta = await readMeta(dir);
    if (!meta) throw new Error(`Recording not found: ${id}`);

    // Fire-and-forget: walk chunks serially in the background.
    void (async () => {
      for (const chunk of meta.chunks) {
        if (chunk.status === 'transcribed') continue;
        const result = await transcribeFile(chunk.audioUrl, meta.mimeType);
        if (result.ok) {
          chunk.transcription = result.text;
          chunk.status = 'transcribed';
        } else {
          chunk.transcription = '';
          chunk.status = 'failed';
        }
        await writeMeta(dir, meta);
        emitChunkTranscribed(id, chunk.index, chunk.status);
      }
    })();

    return { id };
  },
});