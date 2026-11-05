/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMessageToolCall } from '@/common/chat/chatLib';
import { AskUserToolCard } from '@/renderer/pages/conversation/Messages/MessageQuestion';

const { sendMessageInvoke, answerAskInvoke } = vi.hoisted(() => ({
  sendMessageInvoke: vi.fn(),
  answerAskInvoke: vi.fn(),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  conversation: {
    sendMessage: {
      invoke: sendMessageInvoke,
    },
    answerAsk: {
      invoke: answerAskInvoke,
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const makeToolCall = (overrides: Partial<IMessageToolCall['content']> = {}): IMessageToolCall => ({
  id: 'tool-call-1',
  msg_id: 'db-tool-call-1',
  conversation_id: 'conversation-1',
  type: 'tool_call',
  position: 'left',
  content: {
    call_id: 'call-1',
    name: 'mcp__badouwork-ask-user__ask_user',
    status: 'completed',
    args: {
      questions: [
        {
          header: 'Deployment',
          question: 'Which platform should the app target first?',
          options: [
            { label: 'Mini Program', description: 'Zero-install for family members' },
            { label: 'Web/PWA', description: 'Runs on desktop and mobile browsers' },
          ],
        },
        {
          header: 'Data',
          question: 'Should we track spending amounts?',
          multiSelect: false,
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      ],
    },
    ...overrides,
  },
});

describe('AskUserToolCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMessageInvoke.mockResolvedValue(undefined);
    answerAskInvoke.mockResolvedValue(undefined);
  });

  it('renders the questions carried by the tool call arguments', () => {
    render(<AskUserToolCard message={makeToolCall()} />);

    expect(screen.getByTestId('message-ask-user-card')).toBeTruthy();
    expect(screen.getByText('Which platform should the app target first?')).toBeTruthy();
    expect(screen.getByText('Should we track spending amounts?')).toBeTruthy();
    expect(screen.getByText('Mini Program')).toBeTruthy();
    expect(screen.getByText('Zero-install for family members')).toBeTruthy();
  });

  it('falls back to the input field when args are missing', () => {
    render(
      <AskUserToolCard
        message={makeToolCall({
          args: undefined as never,
          input: {
            questions: [{ question: 'Fallback question?', options: [{ label: 'A' }, { label: 'B' }] }],
          },
        })}
      />
    );

    expect(screen.getByText('Fallback question?')).toBeTruthy();
  });

  it('renders nothing when the tool call carries no questions', () => {
    const { container } = render(<AskUserToolCard message={makeToolCall({ args: {} as never })} />);
    expect(container.querySelector('[data-testid="message-ask-user-card"]')).toBeNull();
  });

  it('keeps submit disabled until every question is answered', () => {
    render(<AskUserToolCard message={makeToolCall()} />);

    const submit = screen.getByTestId('message-question-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('message-question-option-0-Mini Program'));

    const stillDisabled = screen.getByTestId('message-question-submit') as HTMLButtonElement;
    expect(stillDisabled.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('message-question-option-1-Yes'));

    const enabled = screen.getByTestId('message-question-submit') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
  });

  it('sends every answer back as a user message when submitted', async () => {
    render(<AskUserToolCard message={makeToolCall()} />);

    fireEvent.click(screen.getByTestId('message-question-option-0-Mini Program'));
    fireEvent.click(screen.getByTestId('message-question-option-1-No'));
    fireEvent.click(screen.getByTestId('message-question-submit'));

    await waitFor(() => expect(sendMessageInvoke).toHaveBeenCalledTimes(1));
    const payload = sendMessageInvoke.mock.calls[0][0];
    expect(payload.conversation_id).toBe('conversation-1');
    expect(payload.input).toContain('Which platform should the app target first?');
    expect(payload.input).toContain('Mini Program');
    expect(payload.input).toContain('Should we track spending amounts?');
    expect(payload.input).toContain('No');
  });

  it('does not send anything before submit', () => {
    render(<AskUserToolCard message={makeToolCall()} />);
    fireEvent.click(screen.getByTestId('message-question-option-0-Mini Program'));
    expect(sendMessageInvoke).not.toHaveBeenCalled();
  });

  it('shows the answered state and hides the actions once submitted', async () => {
    render(<AskUserToolCard message={makeToolCall()} />);

    fireEvent.click(screen.getByTestId('message-question-option-0-Mini Program'));
    fireEvent.click(screen.getByTestId('message-question-option-1-Yes'));
    fireEvent.click(screen.getByTestId('message-question-submit'));

    await waitFor(() => expect(screen.getByTestId('message-question-status')).toBeTruthy());
    expect(screen.queryByTestId('message-question-submit')).toBeNull();
  });

  it('renders read-only when the question was already answered', () => {
    render(<AskUserToolCard message={makeToolCall()} answered />);

    expect(screen.queryByTestId('message-question-submit')).toBeNull();
    expect(screen.getByTestId('message-question-status')).toBeTruthy();
  });

  it('supports multiple selections on a multi-select question', async () => {
    const message = makeToolCall({
      args: {
        questions: [
          {
            question: 'Which modules are in scope?',
            multiSelect: true,
            options: [{ label: 'Auth' }, { label: 'Billing' }, { label: 'Search' }],
          },
        ],
      } as never,
    });

    render(<AskUserToolCard message={message} />);

    fireEvent.click(screen.getByTestId('message-question-option-0-Auth'));
    fireEvent.click(screen.getByTestId('message-question-option-0-Billing'));
    fireEvent.click(screen.getByTestId('message-question-submit'));

    await waitFor(() => expect(sendMessageInvoke).toHaveBeenCalledTimes(1));
    const input = sendMessageInvoke.mock.calls[0][0].input as string;
    expect(input).toContain('Auth');
    expect(input).toContain('Billing');
    expect(input).not.toContain('Search');
  });
});
