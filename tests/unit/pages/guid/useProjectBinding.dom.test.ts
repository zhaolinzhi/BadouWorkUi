import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProjectBinding } from '@/renderer/pages/guid/hooks/useProjectBinding';

vi.mock('@/renderer/api/projectBinding', () => ({
  getProjectBinding: vi.fn(),
  saveProjectBinding: vi.fn(),
  clearProjectBinding: vi.fn(),
}));

import { getProjectBinding, saveProjectBinding, clearProjectBinding } from '@/renderer/api/projectBinding';

const mockedGet = vi.mocked(getProjectBinding);
const mockedSave = vi.mocked(saveProjectBinding);
const mockedClear = vi.mocked(clearProjectBinding);

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
    mockedGet.mockResolvedValueOnce(binding);
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('bound'));
    expect(result.current.binding).toEqual(binding);
  });

  it('200 + null → status=missing', async () => {
    mockedGet.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.binding).toBeNull();
  });

  it('fetch 异常 → status=error', async () => {
    mockedGet.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('boom');
  });

  it('save() → POST 并更新 binding', async () => {
    mockedGet.mockResolvedValueOnce(null);
    const saved = {
      projectId: 'p1',
      assistantId: 'a1',
      folderPath: '/tmp/y',
      updatedAt: '2026-08-26T00:00:00Z',
    };
    mockedSave.mockResolvedValueOnce(saved);
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
    mockedGet.mockResolvedValueOnce(initial);
    mockedClear.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProjectBinding('p1'));
    await waitFor(() => expect(result.current.status).toBe('bound'));
    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.status).toBe('missing');
    expect(result.current.binding).toBeNull();
  });
});