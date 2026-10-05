/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * White-box tests for the simplified FeedbackReportModal (phone + description →
 * AIPaaS saveFeedback). Verifies rendering, validity, submit flow across all
 * SubmitAiFeedbackResult branches, the no-token guard, and that legacy
 * diagnostics props are ignored without crashing the form.
 *
 * Each submit-flow test creates its own React root and user-event instance so
 * that AionModal's focus trap + concurrent click handling doesn't leak across
 * tests. We also drive the Submit button via fireEvent.click wrapped in act(),
 * which has proved more reliable than userEvent.click through the ModalWrapper
 * focus-trap stack.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from '@arco-design/web-react';

// react-dom 19 + testing-library requires IS_REACT_ACT_ENVIRONMENT to be set
// globally so that act() flushes state updates from within useEffect callbacks
// (e.g. the 80ms description-focus effect inside FeedbackReportModal). Without
// this, the modal's post-mount setState is left out of any act() boundary and
// subsequent user.type() / fireEvent.click() calls race against it.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@arco-design/web-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arco-design/web-react')>();
  return {
    ...actual,
    Message: {
      ...actual.Message,
      success: vi.fn(),
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

// FeedbackReportModal renders through AionModal, which reads ThemeContext for
// font scaling. Provide a minimal theme so the modal mounts without the real
// ThemeProvider (which pulls in IPC-backed theme loading).
vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ theme: 'light', fontScale: 1 }),
}));

const { submitSpy, notifySpy, authState, messageSuccessSpy } = vi.hoisted(() => ({
  submitSpy: vi.fn(),
  notifySpy: vi.fn(),
  authState: { user: { token: 'test-token' } as { token: string } | null },
  messageSuccessSpy: vi.fn(),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    notifyTokenExpired: notifySpy,
  }),
}));

vi.mock('@/renderer/services/feedback/submitAiFeedback', () => ({
  submitAiFeedback: submitSpy,
  AI_FEEDBACK_CONTENT_MAX_LENGTH: 2000,
  AI_FEEDBACK_PHONE_MAX_LENGTH: 20,
}));

vi.mock('@arco-design/web-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@arco-design/web-react')>();
  return {
    ...actual,
    Message: {
      ...actual.Message,
      success: messageSuccessSpy,
    },
  };
});

import FeedbackReportModal, {
  type PrefilledScreenshot,
} from '@/renderer/components/settings/SettingsModal/contents/FeedbackReportModal';

const renderModal = (ui: React.ReactElement) => render(<ConfigProvider>{ui}</ConfigProvider>);

const submitButton = () => screen.getByText('settings.bugReportSubmit').closest('button') as HTMLButtonElement;

const phoneInput = () => screen.getByTestId('feedback-report-phone-input') as HTMLInputElement;
const descriptionInput = () =>
  screen.getByPlaceholderText('settings.bugReportDescriptionPlaceholder') as HTMLTextAreaElement;

/**
 * Fill the two fields, fire the submit click in an act() block, then await
 * the resulting microtask queue. Returns once React has flushed the click
 * handler — callers should then await any assertion waits they need.
 *
 * Note: the type + click sequence is wrapped in a single act() so React's
 * scheduler resolves all state updates from the controlled inputs and the
 * click handler before the await resolves. Splitting act() across
 * userEvent.type() and fireEvent.click() has been observed to leave the
 * Submit button's disabled flag one update behind in subsequent tests that
 * share the same react root — isolating each test in its own render() and
 * batching the click here avoids that race.
 */
const fillAndClickSubmit = async (phone: string, desc: string): Promise<void> => {
  const phoneEl = phoneInput();
  const descEl = descriptionInput();

  // Use fireEvent.change to set controlled-input values in one shot rather
  // than userEvent.type's per-character dispatch. userEvent.type pipelines
  // each keystroke through React's scheduler and sometimes interleaves the
  // AionModal focus-trap setTimeout, leaving the Submit button in the wrong
  // disabled state when click fires. fireEvent.change is synchronous from
  // React's perspective and reliably enables Submit on the next render.
  await act(async () => {
    fireEvent.change(phoneEl, { target: { value: phone } });
    fireEvent.change(descEl, { target: { value: desc } });
  });

  await waitFor(() => {
    expect(submitButton().disabled).toBe(false);
  });

  await act(async () => {
    fireEvent.click(submitButton());
  });
  // Drain submitAiFeedback resolution + any AionModal debounced state update.
  await new Promise((r) => setTimeout(r, 20));
};

describe('FeedbackReportModal — phone + description → AIPaaS', () => {
  beforeEach(() => {
    // Ensure no leftover global electronAPI from other tests interferes.
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
    window.location.hash = '';
    authState.user = { token: 'test-token' };
    notifySpy.mockClear();
    submitSpy.mockReset();
    submitSpy.mockResolvedValue({ ok: true, feedbackId: 'fb-default' });
    messageSuccessSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render form content when visible=false', () => {
    renderModal(<FeedbackReportModal visible={false} onCancel={vi.fn()} />);
    expect(screen.queryByTestId('feedback-report-scroll-body')).not.toBeInTheDocument();
  });

  it('renders phone + description fields when visible=true', () => {
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);
    expect(screen.getByTestId('feedback-report-scroll-body')).toBeInTheDocument();
    expect(phoneInput()).toBeInTheDocument();
    expect(screen.getByPlaceholderText('settings.bugReportPhonePlaceholder')).toBeInTheDocument();
    expect(descriptionInput()).toBeInTheDocument();
  });

  it('does not render the removed module select, screenshot upload, or auto-info banner', () => {
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);
    expect(screen.queryByText('settings.bugReportModuleLabel')).toBeNull();
    expect(screen.queryByText('settings.bugReportAutoInfo')).toBeNull();
    expect(screen.queryByTestId('feedback-report-screenshot-count')).toBeNull();
    expect(screen.queryByTestId('feedback-report-auto-info')).toBeNull();
  });

  it('keeps Submit disabled until both fields have content', async () => {
    const user = userEvent.setup();
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);

    expect(submitButton().disabled).toBe(true);
    await user.type(phoneInput(), '13800138000');
    expect(submitButton().disabled).toBe(true);
    await user.type(descriptionInput(), 'something broke');
    expect(submitButton().disabled).toBe(false);
  });

  it('ignores legacy diagnostics props (module/screenshots/tags/extra/diagnostics) without seeding the form', () => {
    const shots: PrefilledScreenshot[] = [
      { filename: 'shot-a.png', data: new Uint8Array([1, 2, 3]), type: 'image/png' },
    ];
    renderModal(
      <FeedbackReportModal
        visible={true}
        onCancel={vi.fn()}
        defaultModule='mcp-tools'
        prefilledScreenshots={shots}
        feedbackTags={{ agent_error_code: 'X' }}
        feedbackExtra={{ agent_error: { code: 'X' } }}
        feedbackDiagnosticsContext={{ routeAtOpen: '#/conversation/conv-1' }}
      />
    );

    expect(screen.queryByText('settings.bugReportModuleMcp')).toBeNull();
    expect(document.querySelectorAll('.arco-upload-list-item').length).toBe(0);
    expect(phoneInput().value).toBe('');
    expect(descriptionInput().value).toBe('');
  });

  it('submits {content, phone, token} to AIPaaS, then shows success and closes on success', async () => {
    submitSpy.mockResolvedValueOnce({ ok: true, feedbackId: 'fb-1' });
    const onCancel = vi.fn();
    renderModal(<FeedbackReportModal visible={true} onCancel={onCancel} />);

    await fillAndClickSubmit('13800138000', 'the problem');

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith({
      content: 'the problem',
      phone: '13800138000',
      token: 'test-token',
    });
    await waitFor(() => {
      expect(messageSuccessSpy).toHaveBeenCalledWith('settings.bugReportSuccess');
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from phone and description before submitting', async () => {
    submitSpy.mockResolvedValueOnce({ ok: true, feedbackId: 'fb-2' });
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);

    await fillAndClickSubmit('  13800138000  ', '  hello  ');

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith({
      content: 'hello',
      phone: '13800138000',
      token: 'test-token',
    });
  });

  it('shows backend business message inline on business failure (no success, no cancel)', async () => {
    submitSpy.mockResolvedValueOnce({ ok: false, reason: 'business', message: '参数有误' });
    const onCancel = vi.fn();
    renderModal(<FeedbackReportModal visible={true} onCancel={onCancel} />);

    await fillAndClickSubmit('13800138000', 'broken');

    await waitFor(() => {
      expect(screen.getByTestId('feedback-report-error')).toHaveTextContent('参数有误');
    });

    expect(messageSuccessSpy).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('shows inline error on network failure', async () => {
    submitSpy.mockResolvedValueOnce({ ok: false, reason: 'network', message: 'HTTP 500' });
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);

    await fillAndClickSubmit('13800138000', 'broken');

    await waitFor(() => {
      expect(screen.getByTestId('feedback-report-error')).toHaveTextContent('HTTP 500');
    });

    expect(messageSuccessSpy).not.toHaveBeenCalled();
  });

  it('calls notifyTokenExpired("feedback") on unauthorized result and leaves modal open', async () => {
    submitSpy.mockResolvedValueOnce({ ok: false, reason: 'unauthorized' });
    const onCancel = vi.fn();
    renderModal(<FeedbackReportModal visible={true} onCancel={onCancel} />);

    await fillAndClickSubmit('13800138000', 'broken');

    await waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('feedback');
    });

    expect(messageSuccessSpy).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByTestId('feedback-report-error')).toBeNull();
  });

  it('does not call the service when there is no auth token; shows bugReportLoginRequired', async () => {
    authState.user = null;
    renderModal(<FeedbackReportModal visible={true} onCancel={vi.fn()} />);

    await fillAndClickSubmit('13800138000', 'broken');

    await waitFor(() => {
      expect(screen.getByTestId('feedback-report-error')).toHaveTextContent('settings.bugReportLoginRequired');
    });
    expect(submitSpy).not.toHaveBeenCalled();
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('calls onCancel when the close button is clicked', async () => {
    const onCancel = vi.fn();
    renderModal(<FeedbackReportModal visible={true} onCancel={onCancel} />);

    const closeBtn = document.querySelector('button[aria-label="Close"]') as HTMLElement | null;
    expect(closeBtn).not.toBeNull();
    await userEvent.setup().click(closeBtn!);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
