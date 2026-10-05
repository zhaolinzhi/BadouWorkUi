/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { ipcBridge } from '@/common';
import type { MeetingRecording, RecordingChunk, SaveRecordingParams } from '@/common/types/meetingRecording';
import { extractWebmHeader, transcribeFile } from './sttClient';

const RECORDINGS_ROOT = (): string => path.join(app.getPath('userData'), 'meeting-recordings');

/**
 * Per-recording cancel flags consulted by the in-flight transcribe walker.
 * A recording id is added when the renderer asks to stop, and removed at
 * the start of the next `transcribe()` call so a later retry isn't blocked
 * by a stale flag.
 *
 * Note: cancellation is cooperative — the walker checks the flag *between*
 * chunks, so an in-flight STT request (already past the `await fetch` call)
 * will still finish and write its result. That's intentional: aborting a
 * network request mid-flight is more complex than it's worth for a button
 * that's rarely pressed.
 */
const cancelledRecordings = new Set<string>();

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
  status: 'transcribed' | 'failed',
  error?: string
): void => {
  ipcBridge.meetingRecording.chunkTranscribed.emit({ id, chunkIndex, status, error });
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

    // A new transcribe run clears any stale cancel flag from a previous
    // walk on the same recording id. Without this, a quick retry after a
    // cancel would never start.
    cancelledRecordings.delete(id);

    // Fire-and-forget: walk chunks serially in the background.
    void (async () => {
      // Some `MediaRecorder` timeslice implementations emit webm slices
      // without the EBML/Segment/Tracks header after the first slice, which
      // the upstream Whisper decoder rejects with HTTP 400 "Invalid or
      // unsupported audio file". Borrow the header from chunk 0 so every
      // sibling chunk is a self-decodable webm stream. Non-webm recordings
      // (mp4/ogg) keep `extractWebmHeader` returning null and skip repair.
      let webmHeader: Buffer | null = null;
      if (meta.chunks.length > 0) {
        try {
          const firstChunkBytes = await fs.readFile(meta.chunks[0].audioUrl);
          webmHeader = extractWebmHeader(firstChunkBytes);
        } catch {
          webmHeader = null;
        }
      }

      for (const chunk of meta.chunks) {
        if (chunk.status === 'transcribed') continue;
        // Cooperative cancel: check before starting the next chunk. The
        // current chunk's STT request (if any) finishes naturally; we
        // stop the walker from queuing the next one.
        if (cancelledRecordings.has(id)) {
          break;
        }
        const result = await transcribeFile(chunk.audioUrl, meta.mimeType, { webmHeader });
        if (result.ok === true) {
          chunk.transcription = result.text;
          // Persist the full STT response verbatim so future code can read
          // usage / latency / model metadata without re-running the request.
          chunk.raw = result.raw;
          chunk.status = 'transcribed';
          chunk.error = undefined;
        } else {
          const failed = result as { ok: false; error: string };
          chunk.transcription = '';
          chunk.status = 'failed';
          chunk.error = failed.error;
        }
        await writeMeta(dir, meta);
        emitChunkTranscribed(id, chunk.index, chunk.status, chunk.error);
      }
    })();

    return { id };
  },

  /**
   * Cooperative cancellation of an in-flight `transcribe()` walk. The
   * walker checks the cancel flag between chunks, so the currently
   * processing chunk finishes naturally and writes its result; subsequent
   * chunks are left untouched (still `pending` or `failed`).
   *
   * Calling this when nothing is running is a cheap no-op.
   */
  async cancelTranscribe(p: { id: string }): Promise<{ ok: true }> {
    assertUuid(p.id);
    cancelledRecordings.add(p.id);
    return { ok: true };
  },

  /**
   * Read a chunk's bytes for the renderer to feed `<audio src=blob:...>`.
   * Returns base64 because the IPC channel serializes JSON only.
   */
  async readChunk(p: { id: string; chunkIndex: number }): Promise<{ base64: string; mimeType: string }> {
    assertUuid(p.id);
    const dir = path.join(RECORDINGS_ROOT(), p.id);
    const meta = await readMeta(dir);
    if (!meta) throw new Error(`Recording not found: ${p.id}`);
    const chunk = meta.chunks.find((c) => c.index === p.chunkIndex);
    if (!chunk) throw new Error(`Chunk not found: index ${p.chunkIndex}`);
    const bytes = await fs.readFile(chunk.audioUrl);
    return {
      base64: bytes.toString('base64'),
      mimeType: meta.mimeType,
    };
  },
});
