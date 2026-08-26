import { useCallback, useEffect, useState } from 'react';
import { useProjectBinding } from './useProjectBinding';
import type { ProjectBinding } from '@/renderer/api/types';

export type GuidBindingPresetStatus = 'idle' | 'loading' | 'bound' | 'missing' | 'error';

export type AssistantLite = { id: string; name?: string };

export type UseGuidBindingPresetsArgs = {
  projectId: string | undefined;
  requireBinding: boolean;
  assistantsReady: boolean;
  assistants: ReadonlyArray<AssistantLite>;
  checkFolderExists: (path: string) => Promise<boolean>;
  applyPreset: (input: { assistantId: string; folderPath: string }) => void;
};

export type UseGuidBindingPresetsResult = {
  status: GuidBindingPresetStatus;
  binding: ProjectBinding | null;
  error: Error | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  rebind: () => void;
  apply: (binding: ProjectBinding) => void;
  refetch: () => Promise<void>;
};

/**
 * 编排:
 * 1. fetchBinding(projectId)
 * 2. 校验 assistant 在 assistants 列表中
 * 3. 校验 folder 存在(checkFolderExists)
 * 4. 通过则 applyPreset + status=bound;否则打开 modal
 */
export const useGuidBindingPresets = (args: UseGuidBindingPresetsArgs): UseGuidBindingPresetsResult => {
  const { projectId, requireBinding, assistantsReady, assistants, checkFolderExists, applyPreset } = args;
  const { binding, status: fetchStatus, error, refetch } = useProjectBinding(requireBinding ? projectId : undefined);
  const [validated, setValidated] = useState<ProjectBinding | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<GuidBindingPresetStatus>('idle');

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!requireBinding) return;
    if (fetchStatus === 'loading') {
      setStatus('loading');
      return;
    }
    if (fetchStatus === 'error') {
      setStatus('error');
      return;
    }
    if (fetchStatus === 'missing') {
      setStatus('missing');
      setModalOpen(true);
      return;
    }
    if (fetchStatus === 'bound' && binding) {
      const assistantExists = assistants.some((a) => a.id === binding.assistantId);
      if (!assistantExists) {
        setStatus('missing');
        setValidated(null);
        setModalOpen(true);
        return;
      }
      void checkFolderExists(binding.folderPath).then((exists) => {
        if (exists) {
          setValidated(binding);
          setStatus('bound');
          applyPreset({ assistantId: binding.assistantId, folderPath: binding.folderPath });
        } else {
          setStatus('missing');
          setValidated(null);
          setModalOpen(true);
        }
      });
    }
  }, [requireBinding, fetchStatus, binding, assistants, assistantsReady, checkFolderExists, applyPreset]);

  const rebind = useCallback(() => setModalOpen(true), []);

  const apply = useCallback(
    (next: ProjectBinding): void => {
      setValidated(next);
      setStatus('bound');
      applyPreset({ assistantId: next.assistantId, folderPath: next.folderPath });
    },
    [applyPreset]
  );

  return {
    status,
    binding: validated ?? binding,
    error,
    isModalOpen: modalOpen,
    openModal,
    closeModal,
    rebind,
    apply,
    refetch,
  };
};
