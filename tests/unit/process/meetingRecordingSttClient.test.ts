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
  await Promise.all(
    tempFiles.splice(0).map((p) => fs.rm(p, { force: true }))
  );
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

import { transcribeFile } from '../../../packages/desktop/src/process/services/meetingRecording/sttClient';

describe('transcribeFile', () => {
  it('POSTs multipart with file, model, language, prompt on success', async () => {
    const filePath = await writeTempAudio('hello');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '你好世界',
    });

    const result = await transcribeFile(filePath, 'audio/webm');

    expect(result).toEqual({ ok: true, text: '你好世界' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://extranet.badousoft.com:28021/v1/audio/transcriptions');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FakeFormData);
    const entries = (init.body as FakeFormData).entries.map(([k, v]) => [
      k,
      v instanceof FakeFile
        ? { name: v.name, type: v.options.type }
        : v,
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
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' });

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'HTTP 503' });
  });

  it('returns ok:false when fetch throws', async () => {
    const filePath = await writeTempAudio('x');
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await transcribeFile(filePath, 'audio/webm');
    expect(result).toEqual({ ok: false, error: 'ECONNREFUSED' });
  });
});