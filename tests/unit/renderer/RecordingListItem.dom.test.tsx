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

import RecordingListItem from '@/renderer/components/meeting-recording/RecordingListItem';
import type { MeetingRecording } from '@/common/types/meetingRecording';

const sample: MeetingRecording = {
  id: 'rec-1',
  name: 'Test Recording',
  createdAt: 1700000000000,
  durationMs: 65000,
  mimeType: 'audio/webm',
  audioUrl: '/tmp/rec-1/audio.webm',
  transcription: 'Hello world',
};

describe('RecordingListItem', () => {
  it('shows transcription when present', () => {
    render(<RecordingListItem recording={sample} onDelete={() => {}} />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('shows transcriptionPending when transcription is empty', () => {
    render(<RecordingListItem recording={{ ...sample, transcription: '' }} onDelete={() => {}} />);
    expect(screen.getByText('meeting-recording.transcriptionPending')).toBeTruthy();
  });

  it('invokes onDelete when Popconfirm OK is clicked', async () => {
    const onDelete = vi.fn();
    render(<RecordingListItem recording={sample} onDelete={onDelete} />);
    const trigger = screen.getByLabelText('Delete');
    trigger.click();
    const okButton = await screen.findByText('OK');
    okButton.click();
    expect(onDelete).toHaveBeenCalledWith('rec-1');
  });
});
