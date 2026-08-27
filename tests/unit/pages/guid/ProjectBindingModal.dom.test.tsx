import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectBindingModal } from '@/renderer/pages/guid/components/ProjectBindingModal';

const tImpl = (key: string, options?: Record<string, string>): string => {
  let result = key;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      result = result.split(`{{${k}}}`).join(v);
    }
  }
  return result;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: tImpl }),
}));

describe('ProjectBindingModal', () => {
  const assistants = [
    { id: 'a1', name: 'Alpha' },
    { id: 'a2', name: 'Beta' },
  ];

  it('渲染标题、副标题、选择器', () => {
    render(
      <ProjectBindingModal
        visible
        projectId='p1'
        projectName='Demo'
        assistants={assistants}
        initialBinding={null}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onBrowseFolder={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByTestId('project-binding-subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('project-binding-assistant')).toBeInTheDocument();
    expect(screen.getByTestId('project-binding-folder')).toBeInTheDocument();
    expect(screen.getByTestId('project-binding-confirm')).toBeDisabled();
  });

  it('cancel 不调用 save', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectBindingModal
        visible
        projectId='p1'
        projectName='Demo'
        assistants={assistants}
        initialBinding={null}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onBrowseFolder={vi.fn().mockResolvedValue(null)}
      />
    );
    await userEvent.click(screen.getByTestId('project-binding-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('两个字段都填了之后 confirm 可用', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectBindingModal
        visible
        projectId='p1'
        projectName='Demo'
        assistants={assistants}
        initialBinding={{
          projectId: 'p1',
          assistantId: 'a1',
          folderPath: '/tmp/p',
          updatedAt: '2026-08-26T00:00:00.000Z',
        }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        onBrowseFolder={vi.fn().mockResolvedValue(null)}
      />
    );
    await userEvent.click(screen.getByTestId('project-binding-confirm'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ assistantId: 'a1', folderPath: '/tmp/p' }));
  });
});
