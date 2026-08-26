import React from 'react';
import { Tooltip } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import type { ProjectBinding } from '@/renderer/api/types';
import type { AssistantOption } from './ProjectBindingModal';

export interface BoundBadgeProps {
  binding: ProjectBinding;
  assistants: ReadonlyArray<AssistantOption>;
  onRebind: () => void;
}

const basename = (path: string): string => {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
};

export const BoundBadge: React.FC<BoundBadgeProps> = ({ binding, assistants, onRebind }) => {
  const { t } = useTranslation();
  const assistantName = assistants.find((a) => a.id === binding.assistantId)?.name ?? binding.assistantId;
  const folderName = basename(binding.folderPath);
  return (
    <div className='bound-badge' data-testid='bound-badge'>
      <span className='bound-badge__label'>{t('guid.projectBinding.bound')}</span>
      <span className='bound-badge__assistant'>{assistantName}</span>
      <span className='bound-badge__separator'>·</span>
      <Tooltip content={binding.folderPath}>
        <span className='bound-badge__folder'>{folderName}</span>
      </Tooltip>
      <button type='button' className='bound-badge__rebind' onClick={onRebind} data-testid='bound-badge-rebind'>
        {t('guid.projectBinding.rebind')}
      </button>
    </div>
  );
};
