/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'fs/promises';
import path from 'path';

const STT_URL = 'http://extranet.badousoft.com:28021/v1/audio/transcriptions';
const STT_PROMPT = '这是一段中文语音的转录结果。请注意，句子之间应该有合适的标点符号。';
const STT_MODEL = 'whisper-large-v3';
const STT_LANGUAGE = 'zh';

export type SttResult = { ok: true; text: string } | { ok: false; error: string };

// Node 22+ exposes FormData / File / fetch globally. Older runtimes would
// need a fallback (e.g. undici); the project targets Node 22.
export const transcribeFile = async (filePath: string, mimeType: string): Promise<SttResult> => {
  const body = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new File([body], path.basename(filePath), { type: mimeType }));
  form.append('model', STT_MODEL);
  form.append('language', STT_LANGUAGE);
  form.append('prompt', STT_PROMPT);

  try {
    const resp = await fetch(STT_URL, { method: 'POST', body: form });
    if (!resp.ok) {
      // Capture status text + a snippet of the body so the UI can surface
      // 502 Bad Gateway vs 401 Unauthorized vs 400 Bad Request distinctly.
      const statusText = resp.statusText || '';
      let bodySnippet = '';
      try {
        const txt = await resp.text();
        bodySnippet = txt.slice(0, 200).replace(/\s+/g, ' ').trim();
      } catch {
        // ignore
      }
      const detail = bodySnippet ? `: ${bodySnippet}` : statusText ? ` ${statusText}` : '';
      return { ok: false, error: `HTTP ${resp.status}${detail}` };
    }
    const text = (await resp.text()).trim();
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
};