import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoundBadge } from '@/renderer/pages/guid/components/BoundBadge';
import { makeBinding } from '../../../fixtures/projectBinding';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('BoundBadge', () => {
  const assistants = [{ id: 'a1', name: 'Alpha' }];

  it('渲染 bound 标签、智能体名、文件夹 basename', () => {
    render(<BoundBadge binding={makeBinding()} assistants={assistants} onRebind={vi.fn()} />);
    expect(screen.getByTestId('bound-badge')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('bound-badge')).toHaveTextContent('project-1');
  });

  it('点击 rebind 触发 onRebind', async () => {
    const onRebind = vi.fn();
    render(<BoundBadge binding={makeBinding()} assistants={assistants} onRebind={onRebind} />);
    await userEvent.click(screen.getByTestId('bound-badge-rebind'));
    expect(onRebind).toHaveBeenCalled();
  });
});