/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlanModePromptSection from '@/renderer/pages/settings/AssistantSettings/editor/PlanModePromptSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('PlanModePromptSection', () => {
  it('renders nothing when isVisible is false', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PlanModePromptSection
        isVisible={false}
        isReadOnly={false}
        value=''
        onChange={onChange}
        readOnlyLabel='Read only'
      />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('assistant-card-plan-mode-prompt')).toBeNull();
  });

  it('renders the textarea with the current value when visible', () => {
    const onChange = vi.fn();
    render(
      <PlanModePromptSection
        isVisible
        isReadOnly={false}
        value='Prefer 3-step plans.'
        onChange={onChange}
        readOnlyLabel='Read only'
      />
    );
    const textarea = screen.getByTestId('textarea-assistant-plan-mode-prompt') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toBe('Prefer 3-step plans.');
    expect(screen.getByTestId('assistant-card-plan-mode-prompt')).toBeInTheDocument();
  });

  it('calls onChange when the textarea value changes', () => {
    const onChange = vi.fn();
    render(
      <PlanModePromptSection isVisible isReadOnly={false} value='' onChange={onChange} readOnlyLabel='Read only' />
    );
    const textarea = screen.getByTestId('textarea-assistant-plan-mode-prompt');
    fireEvent.change(textarea, { target: { value: 'Always emit a 4-step plan before coding.' } });
    // Arco's Input.TextArea onChange forwards (value, event) — assert the
    // first argument (the value) since that's what the editor cares about.
    expect(onChange.mock.calls[0][0]).toBe('Always emit a 4-step plan before coding.');
  });

  it('disables the textarea when isReadOnly is true', () => {
    const onChange = vi.fn();
    render(<PlanModePromptSection isVisible isReadOnly value='' onChange={onChange} readOnlyLabel='Read only' />);
    const textarea = screen.getByTestId('textarea-assistant-plan-mode-prompt') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });
});
