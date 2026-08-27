import React, { useState } from 'react';
import { Alert, Button, Input, Modal, Select, Message } from '@arco-design/web-react';
import { FolderOpen } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import type { ProjectBinding } from '@/renderer/api/types';

const { Option } = Select;

export type AssistantOption = { id: string; name: string };

export interface ProjectBindingModalProps {
  visible: boolean;
  projectId: string;
  projectName: string;
  assistants: ReadonlyArray<AssistantOption>;
  initialBinding: ProjectBinding | null;
  /** True while binding is being saved — disables controls and shows a hint. */
  saving?: boolean;
  /** Last save error message to surface inline; clears when user retries. */
  saveError?: string | null;
  onCancel: () => void;
  onSubmit: (input: { assistantId: string; folderPath: string }) => Promise<void>;
  onBrowseFolder: () => Promise<string | null>;
}

export const ProjectBindingModal: React.FC<ProjectBindingModalProps> = ({
  visible,
  projectId,
  projectName,
  assistants,
  initialBinding,
  saving = false,
  saveError = null,
  onCancel,
  onSubmit,
  onBrowseFolder,
}) => {
  const { t } = useTranslation();
  const [assistantId, setAssistantId] = useState<string>(initialBinding?.assistantId ?? '');
  const [folderPath, setFolderPath] = useState<string>(initialBinding?.folderPath ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  // Re-sync local form state whenever the modal is re-opened with a fresh
  // initial binding (e.g. user clicked "Change" on the BoundBadge).
  React.useEffect(() => {
    if (visible) {
      setAssistantId(initialBinding?.assistantId ?? '');
      setFolderPath(initialBinding?.folderPath ?? '');
      setAssistantError(null);
    }
  }, [visible, initialBinding]);

  const confirmDisabled = !assistantId || !folderPath || submitting || saving;
  const cancelDisabled = submitting || saving;

  const handleConfirm = async (): Promise<void> => {
    setAssistantError(null);
    if (!assistantId) {
      setAssistantError(t('guid.projectBinding.invalidAssistant'));
      return;
    }
    if (!folderPath) {
      Message.error(t('guid.projectBinding.invalidFolder'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ assistantId, folderPath });
      // onSubmit is expected to throw on failure. If it resolves, the parent
      // will close the modal (apply() → status='bound' → effect-driven close).
    } catch {
      // Inline error is rendered via the `saveError` prop. The modal stays
      // open so the user can retry or hit Cancel.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('guid.projectBinding.title')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      maskClosable={!cancelDisabled}
      escToExit={!cancelDisabled}
      closable={!cancelDisabled}
      data-testid={`project-binding-modal-${projectId}`}
    >
      <p data-testid='project-binding-subtitle'>{t('guid.projectBinding.subtitle', { projectName })}</p>
      {saveError && (
        <Alert type='error' content={saveError} style={{ marginBottom: 12 }} data-testid='project-binding-error' />
      )}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>{t('guid.projectBinding.assistantLabel')}</div>
        <Select
          value={assistantId}
          onChange={setAssistantId}
          placeholder={t('guid.projectBinding.assistantLabel')}
          error={assistantError !== null}
          disabled={saving}
          data-testid='project-binding-assistant'
        >
          {assistants.map((a) => (
            <Option key={a.id} value={a.id}>
              {a.name}
            </Option>
          ))}
        </Select>
        {assistantError && <div style={{ color: 'var(--color-danger, #f53f3f)', marginTop: 4 }}>{assistantError}</div>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>{t('guid.projectBinding.folderLabel')}</div>
        <Input
          value={folderPath}
          onChange={setFolderPath}
          placeholder='/absolute/path/to/folder'
          disabled={saving}
          addAfter={
            <Button
              type='text'
              icon={<FolderOpen />}
              disabled={saving}
              onClick={async () => {
                const picked = await onBrowseFolder();
                if (picked) setFolderPath(picked);
              }}
              data-testid='project-binding-browse'
            >
              {t('guid.projectBinding.browseFolder')}
            </Button>
          }
          data-testid='project-binding-folder'
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={onCancel} disabled={cancelDisabled} data-testid='project-binding-cancel'>
          {t('guid.projectBinding.cancel')}
        </Button>
        <Button
          type='primary'
          loading={submitting || saving}
          disabled={confirmDisabled}
          onClick={handleConfirm}
          data-testid='project-binding-confirm'
        >
          {t('guid.projectBinding.confirm')}
        </Button>
      </div>
    </Modal>
  );
};
