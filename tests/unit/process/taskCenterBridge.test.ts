/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProvider = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    taskCenter: {
      list: { provider: (handler: unknown) => mockProvider(handler) },
    },
  },
}));

const { listTaskCenter, _resetForTest } = await import('@/process/bridge/taskCenterBridge');

beforeEach(() => {
  mockProvider.mockReset();
  // The bridge calls `provider(...)` with itself; capture and forward to the real impl
  mockProvider.mockImplementation((handler: unknown) => handler);
  _resetForTest();
});

afterEach(() => {
  _resetForTest();
});

type HttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  on: (event: string, cb: (chunk?: Buffer | string) => void) => void;
  resume?: () => void;
};

type FakeReq = NodeJS.EventEmitter & {
  destroy: () => void;
  end: (body?: string) => void;
};

const makeFakeReq = (statusCode: number, body: string, contentType = 'application/json'): FakeReq => {
  const emitter = new EventEmitter() as FakeReq;
  emitter.destroy = () => emitter.emit('close');
  emitter.end = () => {
    queueMicrotask(() => {
      const cb = mockProvider.mock.calls[0]?.[1] as ((res: HttpResponse) => void) | undefined;
      // The bridge calls `lib.request(opts, cb)`. We capture the callback via http request.
      // We don't actually use http here — mock node:http.
      if (cb) {
        cb({
          statusCode,
          headers: { 'content-type': contentType },
          on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
            if (event === 'data') cb2(Buffer.from(body));
            if (event === 'end') cb2();
          },
          resume: () => undefined,
        });
      }
    });
  };
  return emitter;
};

const makeFakeErrReq = (err: Error): FakeReq => {
  const emitter = new EventEmitter() as FakeReq;
  emitter.destroy = () => emitter.emit('close');
  emitter.end = () => {
    queueMicrotask(() => emitter.emit('error', err));
  };
  return emitter;
};

vi.mock('node:http', () => ({
  default: {
    request: (...args: unknown[]) => {
      // Capture the callback (second arg) so we can dispatch later
      const cb = args[1] as (res: HttpResponse) => void;
      // Return a controllable emitter
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => {
          cb({
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
              if (event === 'data') cb2(Buffer.from('{"Total":0,"Rows":[]}'));
              if (event === 'end') cb2();
            },
          });
        });
      };
      return emitter;
    },
  },
}));

describe('listTaskCenter', () => {
  it('always calls the backend (no env gate, no fixture fallback)', async () => {
    const httpModule = await import('node:http');
    const spy = vi.spyOn(httpModule.default, 'request');

    const result = await listTaskCenter({
      token: 'tok-1',
      filters: { urgency: 'all', projectId: 'all', type: 'all', keyword: '' },
      pageNo: 1,
      perPageSize: 30,
    });

    expect(spy).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('returns total + rows on 200 JSON response', async () => {
    const httpModule = await import('node:http');
    vi.spyOn(httpModule.default, 'request').mockImplementation(((opts: unknown, cb: (res: HttpResponse) => void) => {
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => {
          cb({
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
              if (event === 'data')
                cb2(
                  Buffer.from(
                    '{"Total":2,"Rows":[{"id":"a","name":"task-A","urgency":0},{"id":"b","name":"task-B","urgency":1}]}'
                  )
                );
              if (event === 'end') cb2();
            },
          });
        });
      };
      return emitter;
    }) as never);

    const result = await listTaskCenter({
      token: 'tok-1',
      filters: { urgency: 'all', projectId: 'all', type: 'all', keyword: '' },
      pageNo: 1,
      perPageSize: 30,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(2);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]?.id).toBe('a');
      expect(result.data.items[0]?.raw).toBeDefined();
    }
  });

  it('returns error on non-2xx status', async () => {
    const httpModule = await import('node:http');
    vi.spyOn(httpModule.default, 'request').mockImplementation(((opts: unknown, cb: (res: HttpResponse) => void) => {
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => {
          cb({
            statusCode: 500,
            headers: {},
            on: (event: string, cb2: () => void) => {
              if (event === 'end') cb2();
            },
            resume: () => undefined,
          });
        });
      };
      return emitter;
    }) as never);

    const result = await listTaskCenter({
      token: 'tok',
      filters: { urgency: 'all', projectId: 'all', type: 'all' },
      pageNo: 1,
      perPageSize: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/HTTP 500/);
  });

  it('returns error on network error', async () => {
    const httpModule = await import('node:http');
    vi.spyOn(httpModule.default, 'request').mockImplementation((() => {
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => emitter.emit('error', new Error('ECONNREFUSED')));
      };
      return emitter;
    }) as never);

    const result = await listTaskCenter({
      token: 'tok',
      filters: {},
      pageNo: 1,
      perPageSize: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/ECONNREFUSED/);
  });

  it('builds the URL with mdCode + filters and the form-encoded body', async () => {
    let capturedOpts: Record<string, unknown> | undefined;
    const httpModule = await import('node:http');
    vi.spyOn(httpModule.default, 'request').mockImplementation(((opts: unknown, cb: (res: HttpResponse) => void) => {
      capturedOpts = opts as Record<string, unknown>;
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => {
          cb({
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
              if (event === 'data') cb2(Buffer.from('{"Total":0,"Rows":[]}'));
              if (event === 'end') cb2();
            },
          });
        });
      };
      return emitter;
    }) as never);

    await listTaskCenter({
      token: 'tok-2',
      filters: { urgency: 0, projectId: 'proj-1', type: 'all', keyword: '策略' },
      pageNo: 3,
      perPageSize: 10,
    });

    expect(capturedOpts?.['method']).toBe('POST');
    expect(capturedOpts?.['headers']).toMatchObject({
      Token: 'tok-2',
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    const path = String(capturedOpts?.['path'] ?? '');
    expect(path).toContain('mdCode=y_project_task_mine');
    expect(path).toContain('urgency=0');
    expect(path).toContain('projectId=proj-1');
  });

  it('returns error when token is empty', async () => {
    const result = await listTaskCenter({
      token: '',
      filters: {},
      pageNo: 1,
      perPageSize: 30,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Missing token/);
  });

  it('returns token_expired code on 2xx response with empty body', async () => {
    const httpModule = await import('node:http');
    vi.spyOn(httpModule.default, 'request').mockImplementation(((_opts: unknown, cb: (res: HttpResponse) => void) => {
      const emitter = new EventEmitter() as FakeReq;
      emitter.destroy = () => emitter.emit('close');
      emitter.end = () => {
        queueMicrotask(() => {
          cb({
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
              if (event === 'end') cb2();
            },
          });
        });
      };
      return emitter;
    }) as never);

    const result = await listTaskCenter({
      token: 'tok',
      filters: { urgency: 'all', projectId: 'all', type: 'all', keyword: '' },
      pageNo: 1,
      perPageSize: 30,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('token_expired');
      expect(result.message).toMatch(/Empty response/);
    }
  });
});

const captureBody = async (filters: ITaskCenterFiltersLike, pageNo = 1): Promise<string> => {
  let capturedBody: string | undefined;
  const httpModule = await import('node:http');
  vi.spyOn(httpModule.default, 'request').mockImplementation(((_opts: unknown, cb: (res: HttpResponse) => void) => {
    const emitter = new EventEmitter() as FakeReq;
    emitter.destroy = () => emitter.emit('close');
    emitter.end = (body?: string) => {
      capturedBody = body;
      queueMicrotask(() => {
        cb({
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          on: (event: string, cb2: (chunk?: Buffer | string) => void) => {
            if (event === 'data') cb2(Buffer.from('{"Total":0,"Rows":[]}'));
            if (event === 'end') cb2();
          },
        });
      });
    };
    return emitter;
  }) as never);

  await listTaskCenter({
    token: 'tok',
    filters,
    pageNo,
    perPageSize: 30,
  });
  if (capturedBody === undefined) throw new Error('body not captured');
  return capturedBody;
};

type ITaskCenterFiltersLike = Parameters<typeof listTaskCenter>[0]['filters'];

describe('listTaskCenter — searchParam body', () => {
  it('always includes the default status entry "0;1" with other-query type', async () => {
    const body = await captureBody({ urgency: 'all', projectId: 'all', type: 'all', keyword: '' });
    const params = new URLSearchParams(body);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([{ name: 'status', value: '0;1', type: 'other-query', tagName: '' }]);
  });

  it('appends a text-query entry for the keyword when keyword is provided', async () => {
    const body = await captureBody({ urgency: 'all', projectId: 'all', type: 'all', keyword: '策略' });
    const params = new URLSearchParams(body);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([
      { name: 'status', value: '0;1', type: 'other-query', tagName: '' },
      { name: 'name', value: '策略', type: 'text-query', tagName: '' },
    ]);
  });

  it('trims whitespace from keyword before adding the text-query entry', async () => {
    const body = await captureBody({ urgency: 'all', projectId: 'all', type: 'all', keyword: '   配置  ' });
    const params = new URLSearchParams(body);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([
      { name: 'status', value: '0;1', type: 'other-query', tagName: '' },
      { name: 'name', value: '配置', type: 'text-query', tagName: '' },
    ]);
  });

  it('omits the keyword entry when keyword is whitespace-only', async () => {
    const body = await captureBody({ urgency: 'all', projectId: 'all', type: 'all', keyword: '   ' });
    const params = new URLSearchParams(body);
    const searchParam = JSON.parse(params.get('searchParam') ?? '[]');
    expect(searchParam).toEqual([{ name: 'status', value: '0;1', type: 'other-query', tagName: '' }]);
  });
});
