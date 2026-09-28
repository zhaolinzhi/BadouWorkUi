/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/common', () => ({ ipcBridge: { meetingRecording: {} } }));

vi.mock('@renderer/hooks/meeting-recording/useMeetingRecorder', () => ({
  useMeetingRecorder: () => ({
    status: 'idle' as const,
    durationMs: 0,
    errorCode: undefined,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => undefined),
    reset: vi.fn(),
  }),
}));

import RecorderPanel from '@/renderer/components/meeting-recording/RecorderPanel';

describe('RecorderPanel', () => {
  it('renders a button labelled meeting-recording.startRecording in idle state', () => {
    render(<RecorderPanel />);
    const button = screen.getByRole('button', { name: 'meeting-recording.startRecording' });
    expect(button).toBeTruthy();
  });
});