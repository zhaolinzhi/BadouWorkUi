/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from '@arco-design/web-react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ theme: 'light', fontScale: 1 }),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ user: { token: 'test-token' }, notifyTokenExpired: () => {} }),
}));

vi.mock('@/renderer/services/feedback/submitAiFeedback', () => ({
  submitAiFeedback: async () => ({ ok: true, feedbackId: 'fb-1' }),
  AI_FEEDBACK_CONTENT_MAX_LENGTH: 2000,
  AI_FEEDBACK_PHONE_MAX_LENGTH: 20,
}));

import FeedbackReportModal from '@/renderer/components/settings/SettingsModal/contents/FeedbackReportModal';

describe('debug', () => {
  it('debug type flow', async () => {
    render(
      <ConfigProvider>
        <FeedbackReportModal visible={true} onCancel={() => {}} />
      </ConfigProvider>
    );
    const matches = screen.queryAllByText('settings.bugReportSubmit');
    const phone = screen.getByTestId('feedback-report-phone-input') as HTMLInputElement;
    const description = screen.getByPlaceholderText('settings.bugReportDescriptionPlaceholder') as HTMLTextAreaElement;
    const submitBtn = matches[0]!.closest('button') as HTMLButtonElement;

    process.stdout.write('\n--- DEBUG ---\n');
    process.stdout.write('phone.value initial: "' + phone.value + '"\n');
    process.stdout.write('description.value initial: "' + description.value + '"\n');
    process.stdout.write('submit.disabled initial: ' + submitBtn.disabled + '\n');

    const user = userEvent.setup();
    await user.type(phone, '13800138000');
    process.stdout.write('after type phone, phone.value: "' + phone.value + '"\n');
    process.stdout.write('after type phone, submit.disabled: ' + submitBtn.disabled + '\n');

    await user.type(description, 'hello');
    process.stdout.write('after type desc, description.value: "' + description.value + '"\n');
    process.stdout.write('after type desc, submit.disabled: ' + submitBtn.disabled + '\n');

    expect(true).toBe(true);
  });
});
