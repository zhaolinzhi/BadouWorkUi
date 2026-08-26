import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectBinding } from '@/renderer/api/types';
import { getProjectBinding, saveProjectBinding, clearProjectBinding } from '@/renderer/api/projectBinding';

export type ProjectBindingStatus = 'idle' | 'loading' | 'missing' | 'bound' | 'error';

export type UseProjectBindingResult = {
  binding: ProjectBinding | null;
  status: ProjectBindingStatus;
  error: Error | null;
  refetch: () => Promise<void>;
  save: (input: { assistantId: string; folderPath: string }) => Promise<ProjectBinding>;
  clear: () => Promise<void>;
};

/**
 * 拉取/保存/清除 project↔assistant↔folder 绑定。
 * - 组件挂载或 projectId 变化时自动 fetch
 * - 卸载时通过 AbortController 取消进行中的请求
 */
export const useProjectBinding = (projectId: string | undefined): UseProjectBindingResult => {
  const [binding, setBinding] = useState<ProjectBinding | null>(null);
  const [status, setStatus] = useState<ProjectBindingStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setBinding(null);
      setStatus('missing');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus('loading');
    setError(null);
    try {
      const result = await getProjectBinding(projectId);
      if (ctrl.signal.aborted) return;
      setBinding(result);
      setStatus(result ? 'bound' : 'missing');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    }
  }, [projectId]);

  useEffect(() => {
    void refetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch]);

  const save = useCallback(
    async (input: { assistantId: string; folderPath: string }): Promise<ProjectBinding> => {
      if (!projectId) throw new Error('projectId is required');
      setStatus('loading');
      setError(null);
      try {
        const next = await saveProjectBinding({ projectId, ...input });
        setBinding(next);
        setStatus('bound');
        return next;
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
        throw e;
      }
    },
    [projectId]
  );

  const clear = useCallback(async (): Promise<void> => {
    if (!projectId) return;
    setStatus('loading');
    setError(null);
    try {
      await clearProjectBinding(projectId);
      setBinding(null);
      setStatus('missing');
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
      throw e;
    }
  }, [projectId]);

  return { binding, status, error, refetch, save, clear };
};