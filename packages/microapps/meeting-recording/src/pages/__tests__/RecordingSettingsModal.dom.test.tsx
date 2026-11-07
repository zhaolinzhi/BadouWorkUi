/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

import RecordingSettingsModal from '../RecordingSettingsModal';

/** 默认名由调用方在打开弹窗的那一刻生成 —— 测试里给一个固定值。 */
const buildDefaultName = () => '录音 · 10月26日 10:24';

describe('RecordingSettingsModal', () => {
  it('展示标题、录音来源与「麦克风已就绪」提示', () => {
    render(
      <RecordingSettingsModal visible buildDefaultName={buildDefaultName} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText('录音设置')).toBeTruthy();
    expect(screen.getByText('按需调整声音来源，确认后开始录音。')).toBeTruthy();
    expect(screen.getByText('麦克风')).toBeTruthy();
    expect(screen.getByText('记录你和身边的声音')).toBeTruthy();
    expect(screen.getByText('麦克风已就绪')).toBeTruthy();
  });

  it('系统声音置灰 —— 底层还没有采集系统声音的能力', () => {
    render(
      <RecordingSettingsModal visible buildDefaultName={buildDefaultName} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText('系统声音')).toBeTruthy();
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // 两个来源各一个 checkbox,系统声音那个是禁用的
    expect(checkboxes.length).toBe(2);
    expect(checkboxes[1].disabled).toBe(true);
  });

  it('展开「更多设置」后录音名称可填,设备与语言置灰', () => {
    render(
      <RecordingSettingsModal visible buildDefaultName={buildDefaultName} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: '更多设置' }));

    const nameInput = screen.getByLabelText('录音名称（选填）') as HTMLInputElement;
    expect(nameInput.value).toBe('录音 · 10月26日 10:24');
    fireEvent.change(nameInput, { target: { value: '周会' } });
    expect(nameInput.value).toBe('周会');

    // 设备与语言两个下拉都是禁用的
    const combos = screen.getAllByRole('combobox') as HTMLElement[];
    expect(combos.length).toBe(2);
    combos.forEach((combo) => {
      expect(combo.getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('确认时回传用户填的名字,取消时不回传', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <RecordingSettingsModal visible buildDefaultName={buildDefaultName} onCancel={onCancel} onConfirm={onConfirm} />
    );

    fireEvent.click(screen.getByRole('button', { name: '更多设置' }));
    fireEvent.change(screen.getByLabelText('录音名称（选填）'), { target: { value: '  周会  ' } });
    fireEvent.click(screen.getByTestId('recording-settings-start'));
    expect(onConfirm).toHaveBeenCalledWith('周会');

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
