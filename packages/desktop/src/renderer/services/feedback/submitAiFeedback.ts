/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIPAAS_BASE_URL } from '@/renderer/api/config';

/**
 * Endpoint path on the AIPaaS backend (mounted under AIPAAS_BASE_URL).
 * See docs/superpowers/specs/2026-09-18-aifeedback-api.md.
 */
export const AI_FEEDBACK_SAVE_PATH = '/project/aifeedback/feedbacksave/aifeedback/saveFeedback';

/** Length cap mirrored from the backend — server truncates content beyond this. */
export const AI_FEEDBACK_CONTENT_MAX_LENGTH = 2000;
export const AI_FEEDBACK_PHONE_MAX_LENGTH = 20;

export type SubmitAiFeedbackInput = {
  content: string;
  phone: string;
  token: string;
};

export type AiFeedbackEnvelope = {
  hasOk: boolean;
  tip?: string | null;
  message: string;
  bean?: string | null;
  save?: boolean;
};

export type SubmitAiFeedbackResult =
  | { ok: true; feedbackId: string }
  | { ok: false; reason: 'business'; message: string }
  | { ok: false; reason: 'unauthorized' }
  | { ok: false; reason: 'network'; message: string };

/**
 * POST `/project/aifeedback/feedbacksave/aifeedback/saveFeedback` straight to
 * AIPaaS with the caller's JWT in the `Token` header (matches the
 * convention used by `useKnowledgeBaseList.ts` and other direct-to-AIPaaS
 * callers in this project — the API doc's `Authorization: Bearer …` header
 * is *not* what the live backend expects).
 *
 * The endpoint returns a JSON envelope with these fields:
 *   `{ hasOk, message, bean, tip, save }`
 * (`bean` carries the new feedback id; `success` is the public alias and
 * `data` is not present — both are what the API doc shows, but the live
 * service uses different names.) Success means `hasOk === true`; business
 * failure means `hasOk === false` with a Chinese `message`. HTTP 401 (raised
 * by the global interceptor on a stale JWT) is surfaced as `unauthorized`
 * so the caller can route the user to login. Empty 2xx bodies are also
 * treated as auth-expiry, mirroring the KB list loader.
 *
 * Pure network layer — no React, no UI side effects. Callers are expected to
 * pass `token` explicitly (read from `useAuth().user.token`) so this helper
 * remains usable from non-React contexts (e.g. tests, future main-process
 * fallback).
 */
export async function submitAiFeedback(input: SubmitAiFeedbackInput): Promise<SubmitAiFeedbackResult> {
  const url = `${AIPAAS_BASE_URL}${AI_FEEDBACK_SAVE_PATH}`;

  let response: Response;
  try {
    // Backend expects `application/x-www-form-urlencoded` (form fields
    // `content` and `phone`) — NOT JSON. Encode manually so we don't have to
    // pull in a polyfill and so the URLSearchParams-toString path runs the
    // built-in percent-encoding.
    const formBody = new URLSearchParams({
      content: input.content,
      phone: input.phone,
    }).toString();
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Token: input.token,
      },
      credentials: 'include',
      body: formBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: 'network', message };
  }

  if (response.status === 401) {
    return { ok: false, reason: 'unauthorized' };
  }

  if (!response.ok) {
    return { ok: false, reason: 'network', message: `HTTP ${response.status}` };
  }

  const text = await response.text();
  if (text.trim() === '') {
    // Empty 2xx body on a session-protected endpoint means the global
    // interceptor stripped the response — treat as expired auth.
    return { ok: false, reason: 'unauthorized' };
  }

  let envelope: AiFeedbackEnvelope | null = null;
  try {
    envelope = JSON.parse(text) as AiFeedbackEnvelope;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: 'network', message };
  }

  if (envelope && envelope.hasOk === true) {
    return { ok: true, feedbackId: envelope.bean ?? '' };
  }

  return {
    ok: false,
    reason: 'business',
    message: envelope?.message ?? '提交失败，请稍后重试',
  };
}
