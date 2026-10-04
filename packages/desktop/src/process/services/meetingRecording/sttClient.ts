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

export type SttResult = { ok: true; text: string; raw: unknown } | { ok: false; error: string };

/**
 * HTTP statuses worth retrying once. These all indicate the upstream is
 * transiently unhealthy (proxy lost connection, service overloaded, gateway
 * timed out). 4xx — especially 400 "Invalid audio" — reflects a real request
 * problem and must NOT be retried; doing so just wastes time and floods the
 * upstream with the same bad payload.
 */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Single retry delay. Short enough not to feel like a hang on the UI. */
const RETRY_DELAY_MS = 1500;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Internal attempt result — same shape as `SttResult` but failures carry the
 * HTTP status code so the caller can decide whether to retry. We keep this
 * distinct from `SttResult` so the public type stays clean (callers don't
 * need to know about `status`).
 */
type AttemptResult = { ok: true; text: string; raw: unknown } | { ok: false; error: string; status: number | undefined };

// Node 22+ exposes FormData / File / fetch globally. Older runtimes would
// need a fallback (e.g. undici); the project targets Node 22.

/**
 * EBML magic prefix (`0x1A 0x45 0xDF 0xA3`). Every valid webm/matroska file
 * starts with these four bytes — absent on a recorded chunk means it's a
 * "middle slice" missing the EBML/Segment/Tracks header, which the upstream
 * Whisper decoder rejects with HTTP 400 "Invalid or unsupported audio file".
 */
const WEBM_EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/**
 * How many bytes from the start of chunk 0 to copy as the "header prefix"
 * for header-less sibling chunks. Webm's EBML header + Segment Information
 * + Tracks (with codec private data) typically fits in 4 KiB; the rest is
 * Cluster audio data we don't want to duplicate. This cap also bounds the
 * memory cost if a maliciously-crafted file is recorded locally.
 */
const WEBM_HEADER_MAX_BYTES = 4096;

/**
 * Test whether a recorded chunk already carries the webm EBML magic at its
 * start. Exported so the main-process service can decide whether to attach
 * a borrowed header when calling `transcribeFile`.
 */
export const hasWebmHeader = (bytes: Buffer): boolean => {
  if (bytes.length < WEBM_EBML_MAGIC.length) return false;
  return bytes.subarray(0, WEBM_EBML_MAGIC.length).equals(WEBM_EBML_MAGIC);
};

/**
 * Extract a header prefix from the first chunk of a recording: take the
 * first `WEBM_HEADER_MAX_BYTES` if (and only if) that chunk opens with the
 * EBML magic. Returns `null` for non-webm recordings (e.g. mp4/ogg), where
 * Whisper has its own demuxer behavior and our repair would do more harm
 * than good.
 */
export const extractWebmHeader = (firstChunkBytes: Buffer): Buffer | null => {
  if (!hasWebmHeader(firstChunkBytes)) return null;
  return firstChunkBytes.subarray(0, Math.min(WEBM_HEADER_MAX_BYTES, firstChunkBytes.length));
};

/**
 * Prepend a borrowed webm header to a chunk that's missing one. Returns the
 * original buffer untouched when `header` is null (non-webm) or the chunk
 * already has a header (no-op).
 */
export const repairWebmChunk = (chunkBytes: Buffer, header: Buffer | null): Buffer => {
  if (header === null || hasWebmHeader(chunkBytes)) return chunkBytes;
  // `Buffer.concat` returns `Buffer<ArrayBuffer>` while `fs.readFile` returns
  // `Buffer<ArrayBufferLike>` — normalize to the latter so the resulting
  // type satisfies the strict `File`/`Blob` constructor's `BlobPart`.
  return Buffer.concat([header, chunkBytes]) as Buffer;
};

export type TranscribeOptions = {
  /** Header bytes to prepend if `chunkBytes` lacks the EBML magic. */
  webmHeader?: Buffer | null;
};

export const transcribeFile = async (
  filePath: string,
  mimeType: string,
  options: TranscribeOptions = {}
): Promise<SttResult> => {
  const raw = await fs.readFile(filePath);
  const body = repairWebmChunk(raw, options.webmHeader ?? null);
  const form = new FormData();
  // `BlobPart` requires `ArrayBuffer` (not `ArrayBufferLike`) under strict
  // lib.dom typings. Copy into a fresh `ArrayBuffer` so the resulting
  // Uint8Array satisfies the `BufferSource` constraint; the cost is one
  // memcpy per chunk, which is negligible vs. the STT round-trip.
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  form.append('file', new File([copy], path.basename(filePath), { type: mimeType }));
  form.append('model', STT_MODEL);
  form.append('language', STT_LANGUAGE);
  form.append('prompt', STT_PROMPT);

  const attempt = async (): Promise<AttemptResult> => {
    try {
      const resp = await fetch(STT_URL, {
        method: 'POST',
        body: form,
        headers: {
          // Mimic curl: some corporate reverse proxies reject non-browser UAs
          // before forwarding to upstream.
          'User-Agent': 'curl/8.7.1',
          Accept: '*/*',
        },
      });
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
        return { ok: false, error: `HTTP ${resp.status}${detail}`, status: resp.status };
      }
      // The endpoint returns JSON: {"text": "...", "usage": {...}}.
      // Older/degenerate responses may return plain text — accept either.
      // We always preserve the full parsed JSON as `raw` so callers can
      // surface additional fields (token usage, latency, model metadata)
      // without a second STT round-trip. Plain-text responses wrap the
      // body in `{ text }` so the contract is uniform downstream.
      const body = (await resp.text()).trim();
      try {
        const parsed = JSON.parse(body) as { text?: unknown };
        if (typeof parsed.text === 'string') {
          return { ok: true, text: parsed.text, raw: parsed };
        }
        // JSON without a string `text` field — store the whole object but
        // fall back to the serialized body as the user-visible transcript.
        return { ok: true, text: body, raw: parsed };
      } catch {
        // not JSON — wrap the plain text so `raw` is always populated.
        return { ok: true, text: body, raw: { text: body } };
      }
    } catch (error) {
      return { ok: false, error: (error as Error).message, status: undefined };
    }
  };

  const first = await attempt();
  if (first.ok === true) return first;

  // 4xx — especially 400 "Invalid audio" — reflects a real request problem
  // and must NOT be retried; doing so just wastes time and floods the
  // upstream with the same bad payload. Only retry when the upstream told
  // us it's transient (502/503/504), and only once.
  const status = first.status;
  if (status === undefined || !RETRYABLE_STATUSES.has(status)) {
    return { ok: false, error: first.error };
  }
  await sleep(RETRY_DELAY_MS);
  const retry = await attempt();
  if (retry.ok === true) return retry;
  return { ok: false, error: retry.error };
};
