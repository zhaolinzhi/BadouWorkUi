/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Network-layer tests for the AIPaaS saveFeedback helper.
 * Verifies the request URL/method/headers/form body, every result branch
 * (success, business failure, unauthorized, empty 2xx body, HTTP 500,
 * invalid JSON, fetch rejection), and that the function never throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_FEEDBACK_CONTENT_MAX_LENGTH,
  AI_FEEDBACK_PHONE_MAX_LENGTH,
  AI_FEEDBACK_SAVE_PATH,
  submitAiFeedback,
} from '@/renderer/services/feedback/submitAiFeedback';

const baseInput = {
  content: 'hello world',
  phone: '13800138000',
  token: 'jwt-token',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('submitAiFeedback', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports the documented length caps', () => {
    expect(AI_FEEDBACK_CONTENT_MAX_LENGTH).toBe(2000);
    expect(AI_FEEDBACK_PHONE_MAX_LENGTH).toBe(20);
    expect(AI_FEEDBACK_SAVE_PATH).toBe('/project/aifeedback/feedbacksave/aifeedback/saveFeedback');
  });

  it('POSTs a form-encoded body to the AIPaaS saveFeedback endpoint with the Token header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: true, bean: 'fb-1' }));

    const result = await submitAiFeedback(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(typeof url).toBe('string');
    expect(url.endsWith(AI_FEEDBACK_SAVE_PATH)).toBe(true);
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');

    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded;charset=UTF-8');
    expect(headers['Token']).toBe('jwt-token');

    const body = options.body as string;
    // Round-trip through URLSearchParams to verify percent-encoding recovers the
    // original values (URLSearchParams also serializes keys lexicographically).
    const parsed = new URLSearchParams(body);
    expect(parsed.get('content')).toBe('hello world');
    expect(parsed.get('phone')).toBe('13800138000');

    expect(result).toEqual({ ok: true, feedbackId: 'fb-1' });
  });

  it('percent-encodes special characters in content', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: true, bean: 'fb-x' }));
    await submitAiFeedback({ ...baseInput, content: 'a=b&c=d 漢字' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = options.body as string;
    expect(body).toContain('content=a%3Db%26c%3Dd');
    const parsed = new URLSearchParams(body);
    expect(parsed.get('content')).toBe('a=b&c=d 漢字');
  });

  it('returns ok with empty feedbackId when the envelope omits bean', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: true }));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: true, feedbackId: '' });
  });

  it('surfaces backend business messages verbatim', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: false, message: '提交失败' }));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'business', message: '提交失败' });
  });

  it('falls back to a Chinese default message when the business envelope has no message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: false }));
    const result = await submitAiFeedback(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('business');
      expect(result.message).toBe('提交失败，请稍后重试');
    }
  });

  it('returns unauthorized on HTTP 401 (without parsing the body)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hasOk: false, message: 'x' }, 401));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('returns unauthorized on an empty 2xx body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('returns network failure on HTTP 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'network', message: 'HTTP 500' });
  });

  it('returns network failure with parse error message when JSON is invalid', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>not json</html>', { status: 200 }));
    const result = await submitAiFeedback(baseInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('network');
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('returns network failure with the thrown error message when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'network', message: 'offline' });
  });

  it('coerces a non-Error fetch rejection to its string form', async () => {
    fetchMock.mockRejectedValueOnce('boom-string');
    const result = await submitAiFeedback(baseInput);
    expect(result).toEqual({ ok: false, reason: 'network', message: 'boom-string' });
  });
});
