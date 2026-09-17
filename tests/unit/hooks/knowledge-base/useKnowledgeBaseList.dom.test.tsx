/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const notifyTokenExpired = vi.fn();

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'alice', token: 'tok-1' },
    status: 'authenticated',
    ready: true,
    completeExternalLogin: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    notifyTokenExpired,
  }),
}));

vi.mock('@/renderer/api', () => ({
  AIPAAS_BASE_URL: 'https://example.test',
}));

const { useKnowledgeBaseList } = await import('@/renderer/hooks/knowledge-base/useKnowledgeBaseList');

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
    notifyTokenExpired.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggers notifyTokenExpired when 2xx response body is empty', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    // Auth path runs synchronously; just give React one tick to commit.
    await waitFor(() => expect(notifyTokenExpired).toHaveBeenCalled());
    expect(notifyTokenExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });

  it('triggers notifyTokenExpired on a real 401 status', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('unauthorized', { status: 401 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    await waitFor(() => expect(notifyTokenExpired).toHaveBeenCalled());
    expect(notifyTokenExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });

  it('parses a valid 2xx JSON envelope and does not call notifyTokenExpired', async () => {
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
    expect(notifyTokenExpired).not.toHaveBeenCalled();
  });

  it('sets HTTP 500 error and does not call notifyTokenExpired on a server error', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadPersonalKnowledgeBases('tok-1');
    });

    await waitFor(() => expect(getByTestId('personal-error').textContent).toBe('HTTP 500'));
    expect(notifyTokenExpired).not.toHaveBeenCalled();
  });

  it('sets a SyntaxError-derived message on 2xx with malformed JSON, no logout', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('not json {', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadPersonalKnowledgeBases('tok-1');
    });

    await waitFor(() => expect(getByTestId('personal-error').textContent).toMatch(/JSON/i));
    expect(notifyTokenExpired).not.toHaveBeenCalled();
  });

  it('treats whitespace-only 2xx body as empty (auth)', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => new Response('   \n  ', { status: 200 }));

    const { getByTestId } = renderHarness(async (api) => {
      await api.loadKnowledgeBases();
    });

    await waitFor(() => expect(notifyTokenExpired).toHaveBeenCalled());
    expect(notifyTokenExpired).toHaveBeenCalledWith('knowledge-base');
    expect(getByTestId('personal-error').textContent).toBe('none');
    expect(getByTestId('shared-error').textContent).toBe('none');
  });
});
