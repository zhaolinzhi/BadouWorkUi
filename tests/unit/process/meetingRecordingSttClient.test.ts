/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const tempFiles: string[] = [];

const writeTempAudio = async (contents: string): Promise<string> => {
  const p = path.join(os.tmpdir(), `mr-stt-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`);
  await fs.writeFile(p, contents);
  tempFiles.push(p);
  return p;
};

afterEach(async () => {
  await Promise.all(tempFiles.splice(0).map((p) => fs.rm(p, { force: true })));
});

// Test doubles for FormData / File / fetch.
class FakeFile {
  constructor(
    public parts: unknown[],
    public name: string,
    public options: { type?: string }
  ) {}
}

class FakeFormData {
  entries: Array<[string, unknown]> = [];
  append(key: string, value: unknown): void {
    this.entries.push([key, value]);
  }
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  Object.defineProperty(globalThis, 'FormData', {
    value: FakeFormData,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'File', {
    value: FakeFile,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: fetchMock,
    configurable: true,
    writable: true,
  });
});

import {
  extractWebmHeader,
  hasWebmHeader,
  repairWebmChunk,
  transcribeFile,
} from '../../../packages/desktop/src/process/services/meetingRecording/sttClient';

const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const makeWebm = (length: number, prefix = EBML_MAGIC): Buffer =>
  Buffer.concat([prefix, Buffer.alloc(Math.max(0, length - EBML_MAGIC.length), 0x55)]);

describe('transcribeFile', () => {
  it('POSTs multipart with file, model, language, prompt on success', async () => {
    const filePath = await writeTempAudio('hello');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '你好世界',
    });

    const result = await transcribeFile(filePath, 'audio/webm');

    expect(result).toEqual({ ok: true, text: '你好世界', raw: { text: '你好世界' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://extranet.badousoft.com:28021/v1/audio/transcriptions');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FakeFormData);
    const entries = (init.body as FakeFormData).entries.map(([k, v]) => [
      k,
      v instanceof FakeFile ? { name: v.name, type: v.options.type } : v,
    ]);
    expect(entries).toEqual([
      ['file', { name: expect.stringMatching(/\.webm$/), type: 'audio/webm' }],
      ['model', 'whisper-large-v3'],
      ['language', 'zh'],
      ['prompt', expect.stringContaining('中文')],
    ]);
  });

  it('returns ok:false when HTTP status is non-2xx', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => '',
    });
    // 503 is in the retry set — register a second mock so the retry has a
    // response to consume; otherwise the retry's fetch returns undefined
    // and the test would mask the real failure.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => '',
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'HTTP 503 Service Unavailable' });
  });

  it('does NOT retry on 4xx (400 Bad Request is a real failure)', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '{"error":{"message":"Invalid or unsupported audio file."}}',
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({
      ok: false,
      error: 'HTTP 400: {"error":{"message":"Invalid or unsupported audio file."}}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on 502 and returns the success from the second attempt', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'upstream connect error',
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"第二次成功"}',
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: true, text: '第二次成功', raw: { text: '第二次成功' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on 502 and surfaces the second 502 if upstream is still down', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'upstream connect error',
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => 'still down',
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'HTTP 502: still down' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('includes a body snippet in the error when the server returns one', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html>upstream connect error</html>',
    });
    // Retry for 502.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      text: async () => '<html>upstream connect error</html>',
    });
    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'HTTP 502: <html>upstream connect error</html>' });
  });

  it('returns ok:false when fetch throws', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'ECONNREFUSED' });
  });

  it('preserves extra JSON fields in raw on success', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          text: '你好',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          language: 'zh',
          task: 'transcribe',
        }),
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result.ok).toBe(true);
    if (result.ok !== true) throw new Error('expected ok');
    expect(result.text).toBe('你好');
    // `raw` must carry the full parsed JSON — not just `{ text }`.
    expect(result.raw).toEqual({
      text: '你好',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      language: 'zh',
      task: 'transcribe',
    });
  });

  it('wraps plain-text responses so raw is always populated', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '裸文本回应',
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result.ok).toBe(true);
    if (result.ok !== true) throw new Error('expected ok');
    expect(result.text).toBe('裸文本回应');
    // Non-JSON responses are wrapped in `{ text }` so downstream code can
    // treat `raw` uniformly regardless of upstream behavior.
    expect(result.raw).toEqual({ text: '裸文本回应' });
  });

  it('falls back to raw body when JSON has no string text field', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: 'unexpected shape' }),
    });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result.ok).toBe(true);
    if (result.ok !== true) throw new Error('expected ok');
    // The user-visible text falls back to the serialized body, while the
    // parsed JSON (which lacks a string `text` field) is preserved verbatim.
    expect(result.text).toBe('{"result":"unexpected shape"}');
    expect(result.raw).toEqual({ result: 'unexpected shape' });
  });

  it('prepends the webm header to a header-less chunk before POSTing', async () => {
    const filePath = await writeTempAudio('headerless-data');
    const header = makeWebm(200); // 200 bytes of fake header bytes
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok"}',
    });

    await transcribeFile(filePath, 'audio/webm', { webmHeader: header });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const entries = (init.body as FakeFormData).entries;
    const fileEntry = entries.find(([k]) => k === 'file');
    expect(fileEntry).toBeDefined();
    const fakeFile = fileEntry![1] as FakeFile;
    expect(fakeFile.parts).toHaveLength(1);
    const sentBytes = fakeFile.parts[0] as Uint8Array;
    // The sent body must start with the borrowed EBML magic, not the raw
    // header-less file bytes.
    expect(sentBytes[0]).toBe(EBML_MAGIC[0]);
    expect(sentBytes[1]).toBe(EBML_MAGIC[1]);
    expect(sentBytes[2]).toBe(EBML_MAGIC[2]);
    expect(sentBytes[3]).toBe(EBML_MAGIC[3]);
    // The body must be header + original bytes concatenated.
    expect(sentBytes.byteLength).toBe(header.byteLength + 'headerless-data'.length);
  });

  it('does not duplicate the header when the chunk already has EBML magic', async () => {
    const original = makeWebm(500);
    const filePath = path.join(os.tmpdir(), `mr-stt-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`);
    await fs.writeFile(filePath, original);
    tempFiles.push(filePath);
    const header = makeWebm(200);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok"}',
    });

    await transcribeFile(filePath, 'audio/webm', { webmHeader: header });

    const [, init] = fetchMock.mock.calls[0];
    const entries = (init.body as FakeFormData).entries;
    const fakeFile = entries.find(([k]) => k === 'file')![1] as FakeFile;
    const sentBytes = fakeFile.parts[0] as Uint8Array;
    // Bytes must be exactly the original file (500 bytes), not header + file.
    expect(sentBytes.byteLength).toBe(500);
    expect(sentBytes[0]).toBe(EBML_MAGIC[0]);
  });

  it('passes the file through unchanged when webmHeader is omitted', async () => {
    const filePath = await writeTempAudio('plain-bytes');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"text":"ok"}',
    });

    await transcribeFile(filePath, 'audio/webm');

    const [, init] = fetchMock.mock.calls[0];
    const entries = (init.body as FakeFormData).entries;
    const fakeFile = entries.find(([k]) => k === 'file')![1] as FakeFile;
    const sentBytes = fakeFile.parts[0] as Uint8Array;
    expect(sentBytes.byteLength).toBe('plain-bytes'.length);
  });
});

describe('webm header helpers', () => {
  it('hasWebmHeader returns true only for buffers starting with the EBML magic', () => {
    expect(hasWebmHeader(EBML_MAGIC)).toBe(true);
    expect(hasWebmHeader(makeWebm(64))).toBe(true);
    expect(hasWebmHeader(Buffer.from('not a webm file'))).toBe(false);
    expect(hasWebmHeader(Buffer.alloc(0))).toBe(false);
    // 3 bytes — too short to contain the 4-byte magic.
    expect(hasWebmHeader(Buffer.from([0x1a, 0x45, 0xdf]))).toBe(false);
  });

  it('extractWebmHeader returns null for non-webm buffers', () => {
    expect(extractWebmHeader(Buffer.from('plain text'))).toBeNull();
    expect(extractWebmHeader(Buffer.alloc(0))).toBeNull();
  });

  it('extractWebmHeader caps the prefix at WEBM_HEADER_MAX_BYTES', () => {
    const big = makeWebm(8192);
    const header = extractWebmHeader(big);
    expect(header).not.toBeNull();
    // 4 KiB cap.
    expect(header!.byteLength).toBe(4096);
    // First 4 bytes must still be EBML magic.
    expect(header![0]).toBe(EBML_MAGIC[0]);
  });

  it('repairWebmChunk is a no-op when the chunk already has a header', () => {
    const chunk = makeWebm(500);
    const header = makeWebm(200);
    const out = repairWebmChunk(chunk, header);
    expect(out).toBe(chunk);
  });

  it('repairWebmChunk prepends the header when missing', () => {
    const chunk = Buffer.from('audio-data');
    const header = makeWebm(100);
    const out = repairWebmChunk(chunk, header);
    expect(out.byteLength).toBe(100 + 'audio-data'.length);
    expect(out.subarray(0, 4).equals(EBML_MAGIC)).toBe(true);
    expect(out.subarray(100).equals(chunk)).toBe(true);
  });

  it('repairWebmChunk returns the chunk untouched when header is null', () => {
    const chunk = Buffer.from('headerless');
    const out = repairWebmChunk(chunk, null);
    expect(out).toBe(chunk);
  });
});
