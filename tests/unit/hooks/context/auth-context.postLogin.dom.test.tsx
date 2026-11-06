import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';

const { runNewapiPostLogin, ensureKnowledgeServerMcp, messageWarning } = vi.hoisted(() => ({
  runNewapiPostLogin: vi.fn(),
  ensureKnowledgeServerMcp: vi.fn(),
  messageWarning: vi.fn(),
}));

vi.mock('@/renderer/services/newapi', () => ({
  runNewapiPostLogin,
}));

vi.mock('@/renderer/hooks/mcp/ensureDefaultMcpServers', () => ({
  ensureKnowledgeServerMcp,
}));

vi.mock('@arco-design/web-react', () => ({
  Message: { warning: messageWarning },
}));

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useAuth>) => void }) {
  const api = useAuth();
  React.useEffect(() => {
    if (api.ready) onReady(api);
  }, [api, onReady]);
  return null;
}

beforeEach(() => {
  localStorage.clear();
  runNewapiPostLogin.mockReset();
  ensureKnowledgeServerMcp.mockReset();
  messageWarning.mockReset();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AuthContext.completeExternalLogin → post-login bootstrap', () => {
  it('invokes runNewapiPostLogin exactly once with the same token (fire-and-forget)', async () => {
    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <Probe onReady={(api) => (captured = api)} />
      </AuthProvider>
    );

    // 等 refresh() 把 ready 翻起来
    await act(async () => {
      await Promise.resolve();
    });
    expect(captured).not.toBeNull();

    await act(async () => {
      captured!.completeExternalLogin('JWT-XYZ', { id: 'u-1', username: 'alice' });
    });

    expect(runNewapiPostLogin).toHaveBeenCalledTimes(1);
    expect(runNewapiPostLogin).toHaveBeenCalledWith('JWT-XYZ');
    expect(ensureKnowledgeServerMcp).toHaveBeenCalledTimes(1);
    expect(ensureKnowledgeServerMcp).toHaveBeenCalledWith();
    // fire-and-forget:completeExternalLogin 不该被这个调用阻塞
    expect(captured!.status).toBe('authenticated');
  });

  it('does NOT invoke post-login bootstrap on app restart (refresh path)', async () => {
    localStorage.setItem('external_auth', JSON.stringify({ token: 'STORED', userId: 'u-9', username: 'bob' }));
    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <Probe onReady={(api) => (captured = api)} />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(captured).not.toBeNull();
    expect(captured!.status).toBe('authenticated');
    expect(runNewapiPostLogin).not.toHaveBeenCalled();
    expect(ensureKnowledgeServerMcp).not.toHaveBeenCalled();
  });

  it('does not throw when runNewapiPostLogin rejects (silently swallowed)', async () => {
    runNewapiPostLogin.mockRejectedValueOnce(new Error('boom'));
    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <Probe onReady={(api) => (captured = api)} />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      captured!.completeExternalLogin('JWT', { id: 'u-1', username: 'alice' });
      // 给 microtask 队列一点时间把 rejected promise 消费掉
      await Promise.resolve();
    });

    expect(captured!.status).toBe('authenticated');
  });

  it('does not throw when ensureKnowledgeServerMcp rejects (silently swallowed)', async () => {
    ensureKnowledgeServerMcp.mockRejectedValueOnce(new Error('boom'));
    let captured: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <Probe onReady={(api) => (captured = api)} />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(captured).not.toBeNull();

    await act(async () => {
      captured!.completeExternalLogin('JWT', { id: 'u-1', username: 'alice' });
      await Promise.resolve();
    });

    expect(captured!.status).toBe('authenticated');
  });
});
