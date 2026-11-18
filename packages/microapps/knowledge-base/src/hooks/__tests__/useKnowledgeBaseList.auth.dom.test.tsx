/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 认证失败的降级行为:401 / 空 body → `emitAuthExpired` 回传给 shell 统一登出;
 * 其它错误 → 只写 error 状态,不动会话。
 *
 * shell 侧原来直接调 `notifyTokenExpired`;迁到子应用后统一走
 * `emitAuthExpired('knowledge-base')` —— shell 在 `MicroAppBootstrap` 订阅这个
 * 事件,所以这里断言的是**事件发出**,而不是登出动作本身。
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitAuthExpired = vi.fn();

vi.mock('@aionui/microapp-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aionui/microapp-shared')>()),
  emitAuthExpired,
}));

vi.mock('../../AppContext', () => ({
  useAppRuntime: () => ({ token: 'tok-1' }),
}));

const { useKnowledgeBaseList } = await import('../useKnowledgeBaseList');

/**
 * Render the hook inside a component that surfaces its state via the DOM and
 * re-renders itself after a load completes. Reading state through the
 * returned `api` directly returns the first-render snapshot, so assertions on
 * `personalItems` / `personalError` must go through the DOM after a re-render.
 */
function renderHarness(load: (api: ReturnType<typeof useKnowledgeBaseList>) => Promise<void>) {
  const Harness: React.FC = () => {
    const api = useKnowledgeBaseList();
    const [, force] = React.useState(0);
    React.useEffect(() => {
      void load(api).then(() => force((n) => n + 1));
    }, [api]);
    return (
      <div>
        <span data-testid='personal-items'>{api.personalItems.map((i) => i.id).join(',')}</span>
        <span data-testid='personal-error'>{api.personalError ?? 'none'}</span>
        <span data-testid='shared-error'>{api.sharedError ?? 'none'}</span>
      </div>
    );
  };
  return render(<Harness />);
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('useKnowledgeBaseList — auth-error auto-logout', () => {
  beforeEach(() => {
    emitAuthExpired.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits auth:expired when 2xx response body is empty', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    // Auth path runs synchronously; just give React one tick to commit.
    await waitFor(() => expect(emitAuthExpired).toHaveBeenCalled());
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });

  it('emits auth:expired on a real 401 status', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('unauthorized', { status: 401 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    await waitFor(() => expect(emitAuthExpired).toHaveBeenCalled());
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });

  it('parses a valid 2xx JSON envelope and does not emit auth:expired', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
      if (url.includes('view_knowledge_user')) {
        return jsonResponse({ Total: 1, Rows: [{ id: 'p1', name: 'Personal', storageBaseDesc: 'd' }] });
      }
      return jsonResponse({ Total: 0, Rows: [] });
    });

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadPersonalKnowledgeBases('tok-1');
    });

    await waitFor(() => expect(getByTestId('personal-items').textContent).toBe('p1'));
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('sets HTTP 500 error and does not emit auth:expired on a server error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadPersonalKnowledgeBases('tok-1');
    });

    await waitFor(() => expect(getByTestId('personal-error').textContent).toBe('HTTP 500'));
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('sets a SyntaxError-derived message on 2xx with malformed JSON, no logout', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('not json {', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadPersonalKnowledgeBases('tok-1');
    });

    await waitFor(() => expect(getByTestId('personal-error').textContent).toMatch(/JSON/i));
    expect(emitAuthExpired).not.toHaveBeenCalled();
  });

  it('treats whitespace-only 2xx body as empty (auth)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('   \n  ', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    await waitFor(() => expect(emitAuthExpired).toHaveBeenCalled());
    expect(emitAuthExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });
});
