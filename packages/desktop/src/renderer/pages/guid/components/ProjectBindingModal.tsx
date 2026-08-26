import React, { useState } from 'react';
import { Button, Input, Modal, Select, Message } from '@arco-design/web-react';
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
  onCancel,
  onSubmit,
  onBrowseFolder,
}) => {
  const { t } = useTranslation();
  const [assistantId, setAssistantId] = useState<string>(initialBinding?.assistantId ?? '');
  const [folderPath, setFolderPath] = useState<string>(initialBinding?.folderPath ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const confirmDisabled = !assistantId || !folderPath || submitting;

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
    } catch {
      Message.error(t('guid.projectBinding.saveFailed'));
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
      maskClosable={false}
      data-testid={`project-binding-modal-${projectId}`}
    >
      <p data-testid='project-binding-subtitle'>{t('guid.projectBinding.subtitle', { projectName })}</p>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4 }}>{t('guid.projectBinding.assistantLabel')}</div>
        <Select
          value={assistantId}
          onChange={setAssistantId}
          placeholder={t('guid.projectBinding.assistantLabel')}
          error={assistantError !== null}
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
          addAfter={
            <Button
              type='text'
              icon={<FolderOpen />}
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
        <Button onClick={onCancel} data-testid='project-binding-cancel'>
          {t('guid.projectBinding.cancel')}
        </Button>
        <Button
          type='primary'
          loading={submitting}
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
