/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { ipcBridge } from '@/common';
import {
  PM_CENTER_BASE_URL,
  TASK_CENTER_DEFAULT_PER_PAGE_SIZE,
  TASK_CENTER_TIMEOUT_MS,
  buildTaskCenterListUrl,
} from '@/common/config/taskCenter.config';
import type { ITaskCenterListParams, ITaskCenterListResult, ITaskCenterRow } from '@/common/adapter/ipcBridge';

const inFlight = new Set<http.ClientRequest>();

export const listTaskCenter = async (params: ITaskCenterListParams): Promise<ITaskCenterListResult> => {
  if (!params.token) return { ok: false, message: 'Missing token' };

  const urgency = params.filters.urgency ?? 'all';
  const projectId = params.filters.projectId ?? 'all';
  const type = params.filters.type ?? 'all';
  const keyword = (params.filters.keyword ?? '').trim();

  const fullUrl = buildTaskCenterListUrl({ urgency, projectId, type, keyword });
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    return { ok: false, message: 'Invalid task center URL' };
  }

  const searchParam: Array<Record<string, string>> = [
    { name: 'status', value: '0;1', type: 'other-query', tagName: '' },
  ];
  if (keyword) searchParam.push({ name: 'name', value: keyword, type: 'text-query', tagName: '' });

  const body = new URLSearchParams({
    searchParam: JSON.stringify(searchParam),
    pageNo: String(params.pageNo),
    perPageSize: String(params.perPageSize ?? TASK_CENTER_DEFAULT_PER_PAGE_SIZE),
  }).toString();

  const lib = parsed.protocol === 'https:' ? https : http;
  // TEMP: trace the outgoing task-center request so we can verify the token + URL from the dev terminal.
  console.log('[task-center] → request', {
    url: fullUrl,
    method: 'POST',
    headers: {
      Token: params.token, // FULL token printed for diagnostic purposes; revert after verifying.
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  return new Promise((resolve) => {
    const req = lib.request(
      {
        method: 'POST',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          Token: params.token,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // TEMP: log response status + headers + first 200 chars so we can see the body shape.
        const captureChunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => captureChunks.push(chunk));
        if (status < 200 || status >= 300) {
          res.resume();
          inFlight.delete(req);
          console.log('[task-center] ← non-2xx', { status, headers: res.headers });
          resolve({ ok: false, message: `HTTP ${status}` });
          return;
        }
        res.on('end', () => {
          inFlight.delete(req);
          const text = Buffer.concat(captureChunks).toString('utf8');
          console.log('[task-center] ← response', {
            status,
            headers: res.headers,
            preview: text.slice(0, 200),
            bytes: text.length,
          });
          if (text.length === 0 && status >= 200 && status < 300) {
            resolve({ ok: false, code: 'token_expired', message: 'Empty response from PM center (token may be expired)' });
            return;
          }
          try {
            const parsedBody = JSON.parse(text) as { Total?: number; Rows?: Array<Record<string, unknown>> };
            const total = Number(parsedBody.Total ?? 0);
            const items = (parsedBody.Rows ?? []).map((row) => normalizeRow(row));
            resolve({ ok: true, data: { total, items } });
          } catch (err) {
            console.log('[task-center] ← parse error', { message: err instanceof Error ? err.message : String(err) });
            resolve({ ok: false, code: 'parse_error', message: err instanceof Error ? err.message : String(err) });
          }
        });
        res.on('error', (err) => {
          inFlight.delete(req);
          resolve({ ok: false, message: err.message });
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      inFlight.delete(req);
      // TEMP: trace timeout
      console.log('[task-center] ← timeout', { url: fullUrl, timeoutMs: TASK_CENTER_TIMEOUT_MS });
      resolve({ ok: false, message: 'Request timeout' });
    }, TASK_CENTER_TIMEOUT_MS);

    req.on('close', () => clearTimeout(timer));

    req.on('error', (err) => {
      clearTimeout(timer);
      inFlight.delete(req);
      // TEMP: trace transport-level errors (ECONNREFUSED, DNS, etc.)
      console.log('[task-center] ← transport error', { url: fullUrl, message: err.message });
      resolve({ ok: false, message: err.message });
    });

    inFlight.add(req);
    req.end(body);
  });
};

const pickString = (row: Record<string, unknown>, key: string): string => {
  const v = row[key];
  return v === null || v === undefined ? '' : String(v);
};

const pickNullableString = (row: Record<string, unknown>, key: string): string | null => {
  const v = row[key];
  if (v === null || v === undefined || v === '') return null;
  return String(v);
};

const pickNumber = (row: Record<string, unknown>, key: string): number => {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const normalizeRow = (row: Record<string, unknown>): ITaskCenterRow => ({
  id: pickString(row, 'id'),
  name: pickString(row, 'name'),
  mark: pickString(row, 'mark'),
  projectName: pickString(row, 'projectName'),
  projectId: pickString(row, 'projectId'),
  partName: pickString(row, 'partName'),
  milestoneName: pickString(row, 'milestoneName'),
  type: pickNumber(row, 'type'),
  typeDesc: pickString(row, 'typeDesc'),
  urgency: pickNumber(row, 'urgency'),
  urgencyDesc: pickString(row, 'urgencyDesc'),
  status: pickNumber(row, 'status'),
  statusDesc: pickString(row, 'statusDesc'),
  deadlineTime: pickNullableString(row, 'deadlineTime'),
  startTime: pickNullableString(row, 'startTime'),
  endTime: pickNullableString(row, 'endTime'),
  closeTime: pickNullableString(row, 'closeTime'),
  creator: pickString(row, 'creator'),
  creatorName: pickString(row, 'creatorName'),
  currentUserId: pickString(row, 'currentUserId'),
  currentUserName: pickString(row, 'currentUserName'),
  updator: pickString(row, 'updator'),
  updatorName: pickString(row, 'updatorName'),
  createTime: pickString(row, 'createTime'),
  updateTime: pickString(row, 'updateTime'),
  content: pickNullableString(row, 'content'),
  remark: pickNullableString(row, 'remark'),
  raw: row,
});

export const _resetForTest = (): void => {
  for (const r of inFlight) r.destroy();
  inFlight.clear();
};

/** Register the task-center handlers with the IPC bridge. Called once at startup. */
export const registerTaskCenterBridge = (): void => {
  ipcBridge.taskCenter.list.provider(listTaskCenter);
};

// Re-export for tests
export { PM_CENTER_BASE_URL };
