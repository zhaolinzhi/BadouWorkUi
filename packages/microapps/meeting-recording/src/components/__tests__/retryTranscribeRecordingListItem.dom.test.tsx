/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  transcribeMock: vi.fn(async () => ({ id: 'rec-1' })),
  cancelTranscribeMock: vi.fn(async () => ({ ok: true })),
  readChunkMock: vi.fn(async () => ({ base64: 'AAAA', mimeType: 'audio/webm' })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // 与 react-i18next 未初始化时的行为一致:有 defaultValue 就用它,没有就返回 key。
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

vi.mock('../../__qiankun__/ipc', () => ({
  ipcBridge: {
    get meetingRecording() {
      return {
        readChunk: { invoke: mocks.readChunkMock },
        transcribe: { invoke: mocks.transcribeMock },
        cancelTranscribe: { invoke: mocks.cancelTranscribeMock },
      };
    },
  },
}));

import RecordingListItem from '../RecordingListItem';
import type { MeetingRecording, RecordingChunk } from '@common/types/meetingRecording';

const chunk = (overrides: Partial<RecordingChunk>): RecordingChunk => ({
  index: 0,
  durationMs: 1000,
  audioUrl: '/tmp/x.webm',
  transcription: '',
  status: 'pending',
  ...overrides,
});

const makeRecording = (chunks: RecordingChunk[]): MeetingRecording => ({
  id: 'rec-1',
  name: 'Test',
  createdAt: 0,
  mimeType: 'audio/webm',
  durationMs: chunks.reduce((s, c) => s + c.durationMs, 0),
  chunks,
});

/** 打开「更多操作」菜单。 */
const openMoreMenu = () => {
  fireEvent.click(screen.getByLabelText('更多操作'));
};

/**
 * 菜单项的禁用态落在 Arco 的菜单项容器(`role="menuitem"`)上。
 *
 * 独立渲染的 Menu 用 `arco-menu-disabled`,Dropdown 里的菜单用
 * `arco-dropdown-menu-disabled` —— 只看后缀 `-menu-disabled`。
 */
const isMenuItemDisabled = (testId: string): boolean =>
  (screen.getByTestId(testId).closest('[role="menuitem"]')?.className ?? '').includes('menu-disabled');

describe('RecordingListItem retry-transcribe menu item', () => {
  it('disables the retry item when every chunk is transcribed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, transcription: 'b', status: 'transcribed' }),
        ])}
        onDelete={() => {}}
      />
    );
    openMoreMenu();
    expect(isMenuItemDisabled('retry-transcribe-button')).toBe(true);
  });

  it('enables the retry item when any chunk is pending', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'pending' }),
        ])}
        onDelete={() => {}}
      />
    );
    openMoreMenu();
    expect(isMenuItemDisabled('retry-transcribe-button')).toBe(false);
  });

  it('enables the retry item when any chunk is failed', () => {
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'failed' }),
        ])}
        onDelete={() => {}}
      />
    );
    openMoreMenu();
    expect(isMenuItemDisabled('retry-transcribe-button')).toBe(false);
  });

  it('invokes ipcBridge.meetingRecording.transcribe with the recording id on click', async () => {
    mocks.transcribeMock.mockClear();
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'failed' }),
        ])}
        onDelete={() => {}}
      />
    );
    openMoreMenu();
    fireEvent.click(screen.getByTestId('retry-transcribe-button'));
    expect(mocks.transcribeMock).toHaveBeenCalledTimes(1);
    expect(mocks.transcribeMock).toHaveBeenCalledWith({ id: 'rec-1' });
  });

  it('offers a 停止转写 item while the retry is running, and cancels on confirm', async () => {
    mocks.transcribeMock.mockClear();
    mocks.cancelTranscribeMock.mockClear();
    render(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, status: 'failed' }),
        ])}
        onDelete={() => {}}
      />
    );
    openMoreMenu();
    fireEvent.click(screen.getByTestId('retry-transcribe-button'));
    expect(mocks.transcribeMock).toHaveBeenCalledTimes(1);
    expect(mocks.cancelTranscribeMock).not.toHaveBeenCalled();

    // 重试进行中:菜单里多一项「停止转写」
    openMoreMenu();
    fireEvent.click(screen.getByTestId('cancel-transcribe-button'));
    // 确认弹窗的「停止」按钮
    const okButton = await screen.findByRole('button', { name: '停止' });
    fireEvent.click(okButton);
    expect(mocks.cancelTranscribeMock).toHaveBeenCalledWith({ id: 'rec-1' });
  });

  it('spins the Refresh icon while any chunk is pending or failed after a click', async () => {
    const recording = makeRecording([
      chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
      chunk({ index: 1, status: 'failed' }),
    ]);
    const { rerender } = render(<RecordingListItem recording={recording} onDelete={() => {}} />);
    // 菜单没打开时图标节点不在 DOM 里 —— 先打开菜单再断言。
    openMoreMenu();
    // Sanity: before the click the icon has no spin class.
    expect(screen.getByTestId('retry-transcribe-spin').className).not.toMatch(/spin/);
    fireEvent.click(screen.getByTestId('retry-transcribe-button'));
    // Right after the click the icon should be spinning.
    expect(screen.getByTestId('retry-transcribe-spin').className).toMatch(/spin/);
    // NOTE on the visual-shift fix: the CSS module is not loaded into the
    // jsdom test environment, so `getComputedStyle().display` here always
    // returns 'inline'. The actual layout fix lives in
    // `RecordingListItem.module.css`'s `.spin` rule.
    // Simulate the main process emitting a chunkTranscribed event by
    // handing the row an updated recording where the failed chunk is now
    // still failed (e.g. upstream still down) — the spin must persist.
    rerender(<RecordingListItem recording={recording} onDelete={() => {}} />);
    expect(screen.getByTestId('retry-transcribe-spin').className).toMatch(/spin/);
    // Now simulate the chunk going through: spin must clear.
    rerender(
      <RecordingListItem
        recording={makeRecording([
          chunk({ index: 0, transcription: 'a', status: 'transcribed' }),
          chunk({ index: 1, transcription: 'b', status: 'transcribed' }),
        ])}
        onDelete={() => {}}
      />
    );
    expect(screen.getByTestId('retry-transcribe-spin').className).not.toMatch(/spin/);
  });
});
