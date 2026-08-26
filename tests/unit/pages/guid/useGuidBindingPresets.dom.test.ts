import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGuidBindingPresets } from '@/renderer/pages/guid/hooks/useGuidBindingPresets';
import { makeBinding } from '../../../fixtures/projectBinding';

vi.mock('@/renderer/api/projectBinding', () => ({
  getProjectBinding: vi.fn(),
  saveProjectBinding: vi.fn(),
  clearProjectBinding: vi.fn(),
}));

import { getProjectBinding } from '@/renderer/api/projectBinding';

const mockedGet = vi.mocked(getProjectBinding);

describe('useGuidBindingPresets', () => {
  const assistants = [{ id: 'a1', name: 'Alpha' }];
  const applyPreset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('binding 有效时应用预设', async () => {
    mockedGet.mockResolvedValueOnce(makeBinding());
    const { result } = renderHook(() =>
      useGuidBindingPresets({
        projectId: 'p1',
        requireBinding: true,
        assistantsReady: true,
        assistants,
        checkFolderExists: vi.fn().mockResolvedValue(true),
        applyPreset,
      })
    );
    await waitFor(() => expect(result.current.status).toBe('bound'));
    expect(applyPreset).toHaveBeenCalledWith({ assistantId: 'a1', folderPath: '/tmp/project-1' });
  });

  it('未绑定时打开 modal', async () => {
    mockedGet.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useGuidBindingPresets({
        projectId: 'p1',
        requireBinding: true,
        assistantsReady: true,
        assistants,
        checkFolderExists: vi.fn().mockResolvedValue(true),
        applyPreset,
      })
    );
    await waitFor(() => expect(result.current.status).toBe('missing'));
    expect(result.current.isModalOpen).toBe(true);
  });

  it('智能体不存在时打开 modal', async () => {
    mockedGet.mockResolvedValueOnce(makeBinding({ assistantId: 'gone' }));
    const { result } = renderHook(() =>
      useGuidBindingPresets({
        projectId: 'p1',
        requireBinding: true,
        assistantsReady: true,
        assistants,
        checkFolderExists: vi.fn().mockResolvedValue(true),
        applyPreset,
      })
    );
    await waitFor(() => expect(result.current.isModalOpen).toBe(true));
  });

  it('文件夹不存在时打开 modal', async () => {
    mockedGet.mockResolvedValueOnce(makeBinding());
    const { result } = renderHook(() =>
      useGuidBindingPresets({
        projectId: 'p1',
        requireBinding: true,
        assistantsReady: true,
        assistants,
        checkFolderExists: vi.fn().mockResolvedValue(false),
        applyPreset,
      })
    );
    await waitFor(() => expect(result.current.isModalOpen).toBe(true));
  });

  it('rebind() 打开 modal', async () => {
    mockedGet.mockResolvedValueOnce(makeBinding());
    const { result } = renderHook(() =>
      useGuidBindingPresets({
        projectId: 'p1',
        requireBinding: true,
        assistantsReady: true,
        assistants,
        checkFolderExists: vi.fn().mockResolvedValue(true),
        applyPreset,
      })
    );
    await waitFor(() => expect(result.current.status).toBe('bound'));
    act(() => result.current.rebind());
    expect(result.current.isModalOpen).toBe(true);
  });
});