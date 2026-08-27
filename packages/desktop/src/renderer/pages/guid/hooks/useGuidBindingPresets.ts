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
  /** True while a save is in flight; passed down to disable modal controls. */
  saving: boolean;
  /** Last save error message; cleared when modal closes. */
  saveError: string | null;
  /** True after the user has interacted with the binding flow (opened the modal
   *  or dismissed it once). Once dismissed, the effect will not auto-reopen the
   *  modal — the user must explicitly tap "Bind this project" again. */
  userDismissed: boolean;
  openModal: () => void;
  closeModal: () => void;
  rebind: () => void;
  /** Host-side save that updates internal state and closes the modal on success. */
  saveAndApply: (input: { assistantId: string; folderPath: string }) => Promise<void>;
  refetch: () => Promise<void>;
};

/**
 * 编排:
 * 1. fetchBinding(projectId)
 * 2. 校验 assistant 在 assistants 列表中
 * 3. 校验 folder 存在(checkFolderExists)
 * 4. 通过则 applyPreset + status=bound;否则打开 modal
 *
 * Save 路径(host → saveAndApply):
 * 1. 调底层 saveProjectBinding
 * 2. 应用 preset(设 selectedAssistantId + dir)
 * 3. setValidated(bound) + status='bound'
 * 4. 关闭 modal
 */
export const useGuidBindingPresets = (args: UseGuidBindingPresetsArgs): UseGuidBindingPresetsResult => {
  const { projectId, requireBinding, assistantsReady, assistants, checkFolderExists, applyPreset } = args;
  const { binding, status: fetchStatus, error, save: rawSave, refetch } = useProjectBinding(
    requireBinding ? projectId : undefined
  );
  const [validated, setValidated] = useState<ProjectBinding | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<GuidBindingPresetStatus>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Once the user has dismissed the modal (cancelled or otherwise), we no
  // longer auto-reopen it on every fetch state transition. The user must
  // explicitly tap "Bind this project" to re-engage. Without this guard the
  // effect below would re-open the modal every time `binding`/`assistants`/
  // `fetchStatus` change after a dismissal — i.e. the modal feels "stuck".
  const [userDismissed, setUserDismissed] = useState(false);

  const openModal = useCallback(() => {
    setUserDismissed(false);
    setSaveError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setUserDismissed(true);
    setSaveError(null);
  }, []);

  useEffect(() => {
    if (!requireBinding) return;
    // Don't reopen after the user dismissed once.
    if (userDismissed) return;
    if (fetchStatus === 'loading') {
      setStatus('loading');
      return;
    }
    if (fetchStatus === 'error') {
      // Surface backend errors by opening the modal so the user sees the
      // message inline (via saveError) and can retry. They can also close the
      // modal to skip the bind flow for now.
      setStatus('error');
      setSaveError(error?.message ?? null);
      setModalOpen(true);
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
        // Re-check the dismissed flag inside the async callback: by the time
        // this resolves the user may have cancelled and clicked away.
        if (userDismissed) return;
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
  }, [requireBinding, fetchStatus, binding, assistants, assistantsReady, checkFolderExists, applyPreset, userDismissed]);

  const rebind = useCallback(() => {
    setUserDismissed(false);
    setSaveError(null);
    setModalOpen(true);
  }, []);

  const saveAndApply = useCallback(
    async (input: { assistantId: string; folderPath: string }): Promise<void> => {
      if (!projectId) throw new Error('projectId is required');
      setSaving(true);
      setSaveError(null);
      try {
        // rawSave calls the underlying API and updates useProjectBinding's
        // internal state (binding/status). That triggers the effect above,
        // but we'll close the modal immediately so the user sees instant
        // feedback rather than a flash.
        const next = await rawSave(input);
        setValidated(next);
        setStatus('bound');
        applyPreset({ assistantId: next.assistantId, folderPath: next.folderPath });
        setModalOpen(false);
        setUserDismissed(false); // successfully-bound state should not block re-opens
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
        throw e; // let the modal keep itself open
      } finally {
        setSaving(false);
      }
    },
    [projectId, rawSave, applyPreset]
  );

  return {
    status,
    binding: validated ?? binding,
    error,
    isModalOpen: modalOpen,
    saving,
    saveError,
    userDismissed,
    openModal,
    closeModal,
    rebind,
    saveAndApply,
    refetch,
  };
};
