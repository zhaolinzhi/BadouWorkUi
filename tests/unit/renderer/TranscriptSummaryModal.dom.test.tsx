/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      // Translate known meeting-recording transcriptModal keys to localizable
      // strings with placeholders. Production uses real i18n; here we only
      // need enough fidelity for the tests to assert counts/text.
      const messages: Record<string, string> = {
        'meeting-recording.transcriptModal.disabledHint': 'No transcriptions available yet',
      };
      const message = messages[k] ?? k;
      if (!opts) return message;
      return message.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(opts[name] ?? ''));
    },
  }),
}));

import TranscriptSummaryModal from '@/renderer/components/meeting-recording/TranscriptSummaryModal';
import type { MeetingRecording, RecordingChunk } from '@/common/types/meetingRecording';

const chunk = (overrides: Partial<RecordingChunk>): RecordingChunk => ({
  index: 0,
  durationMs: 1000,
  audioUrl: '/tmp/x.webm',
  transcription: '',
  status: 'pending',
  ...overrides,
});

const recording: MeetingRecording = {
  id: 'r',
  name: '我的录音',
  createdAt: 0,
  mimeType: 'audio/webm',
  durationMs: 120000,
  chunks: [
    chunk({ index: 0, durationMs: 50000, transcription: '第一段文本', status: 'transcribed' }),
    chunk({ index: 1, durationMs: 30000, transcription: '', status: 'failed' }),
    chunk({ index: 2, durationMs: 40000, transcription: '第三段', status: 'transcribed' }),
  ],
};

describe('TranscriptSummaryModal', () => {
  it('renders the recording name as title', () => {
    render(<TranscriptSummaryModal recording={recording} visible={true} onClose={() => {}} />);
    expect(screen.getByText('我的录音')).toBeTruthy();
  });

  it('renders the joined transcript text with double newlines in a copyable paragraph', () => {
    render(<TranscriptSummaryModal recording={recording} visible={true} onClose={() => {}} />);
    // The transcript body sits inside an Arco Typography.Paragraph element.
    // Walk the DOM to find it: it's the only direct child of the modal body
    // containing both joined texts.
    const body = Array.from(document.querySelectorAll('div')).find((el) => {
      const txt = el.textContent ?? '';
      return txt.includes('第一段文本') && txt.includes('第三段');
    }) as HTMLElement | undefined;
    expect(body).toBeTruthy();
    // The double-newline separator must be present in the raw textContent
    // so the copyable button copies it to the clipboard unchanged.
    expect(body!.textContent).toMatch(/第一段文本\n\n第三段/);
  });

  it('does not render the status line or the footer summary', () => {
    render(<TranscriptSummaryModal recording={recording} visible={true} onClose={() => {}} />);
    // Status-line phrases ("chunks", "transcribed", "failed", "pending") and
    // duration labels ("00:50", "00:30", "00:40") must NOT appear anywhere.
    const all = document.body.textContent ?? '';
    expect(all).not.toMatch(/chunks/);
    expect(all).not.toMatch(/00:50/);
    expect(all).not.toMatch(/Chunk/);
  });

  it('renders nothing visible when visible is false', () => {
    render(<TranscriptSummaryModal recording={recording} visible={false} onClose={() => {}} />);
    expect(screen.queryByText('我的录音')).toBeNull();
  });

  it('invokes onClose when the modal OK button is clicked', () => {
    const onClose = vi.fn();
    render(<TranscriptSummaryModal recording={recording} visible={true} onClose={onClose} />);
    const okBtn = screen.getByRole('button', { name: 'common.close' });
    okBtn.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
