import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjectBinding } from '@/renderer/pages/guid/hooks/useProjectBinding';

// Mock only the IPC layer (ipcBridge.projectBinding.get), not the wrapper.
// This exercises the real fallback path in `renderer/api/projectBinding.ts`.
vi.mock('@/common', async () => {
  const actual = await vi.importActual<typeof import('@/common')>('@/common');
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      projectBinding: {
        get: { invoke: vi.fn() },
        put: { invoke: vi.fn() },
        remove: { invoke: vi.fn() },
      },
    },
  };
});

const mockedGet = vi.mocked((await import('@/common')).ipcBridge.projectBinding.get.invoke);
const mockedSave = vi.mocked((await import('@/common')).ipcBridge.projectBinding.put.invoke);
const mockedClear = vi.mocked((await import('@/common')).ipcBridge.projectBinding.remove.invoke);

describe('useProjectBinding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 + binding → status=bound', async () => {
    const binding = {
      projectId: 'p1',
      assistantId: 'a1',
      folderPath: '/tmp/x',
      updatedAt: '2026-08-26T00:00:00Z',
    };
    mockedGet.mockResolvedValueOnce({ binding });
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('bound'));
    expect(result.current.binding).toEqual(binding);
  });

  it('200 + null → status=missing', async () => {
    mockedGet.mockResolvedValueOnce({ binding: null });
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.binding).toBeNull();
  });

  it('fetch 抛 BackendHttpError 4xx 非 404 → 仍作为 error 抛出(不 fallback)', async () => {
    const { BackendHttpError } = await import('@/common/adapter/httpBridge');
    mockedGet.mockRejectedValueOnce(new BackendHttpError({ method: 'GET', path: '/x', status: 403, body: 'forbidden' }));
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('save() → POST 并更新 binding', async () => {
    mockedGet.mockResolvedValueOnce({ binding: null });
    const saved = {
      projectId: 'p1',
      assistantId: 'a1',
      folderPath: '/tmp/y',
      updatedAt: '2026-08-26T00:00:00Z',
    };
    mockedSave.mockResolvedValueOnce({ binding: saved });
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    let out: unknown;
    await act(async () => {
      out = await result.current.save({ assistantId: 'a1', folderPath: '/tmp/y' });
    });
    expect(out).toEqual(saved);
    expect(result.current.status).toBe('bound');
    expect(result.current.binding).toEqual(saved);
  });

  it('clear() → DELETE 并复位到 missing', async () => {
    const initial = {
      projectId: 'p1',
      assistantId: 'a1',
      folderPath: '/tmp/x',
      updatedAt: '2026-08-26T00:00:00Z',
    };
    mockedGet.mockResolvedValueOnce({ binding: initial });
    mockedClear.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('bound'));
    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.status).toBe('missing');
    expect(result.current.binding).toBeNull();
  });

  it('fetch 抛 BackendHttpError 404 → 当作 missing 处理', async () => {
    const { BackendHttpError } = await import('@/common/adapter/httpBridge');
    mockedGet.mockRejectedValueOnce(new BackendHttpError({ method: 'GET', path: '/x', status: 404, body: 'not found' }));
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.binding).toBeNull();
  });

  it('fetch 抛网络错误 → 自动 fallback 到 mock 后回到 missing', async () => {
    mockedGet.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect((globalThis as { __aionuiMockProjectBinding?: boolean }).__aionuiMockProjectBinding).toBe(true);
  });
});
