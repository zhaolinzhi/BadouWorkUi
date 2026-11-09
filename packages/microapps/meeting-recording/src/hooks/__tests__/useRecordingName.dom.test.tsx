/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
    i18n: { language: 'zh-CN' },
  }),
}));

import { buildRecordingName, useRecordingName } from '../useRecordingName';

describe('useRecordingName', () => {
  it('默认名是「前缀 + 日期时间」,与设计稿一致', () => {
    const { result } = renderHook(() => useRecordingName());
    const name = result.current.buildDefaultName();
    expect(name.startsWith('录音 · ')).toBe(true);
    // zh-CN 下日期部分是「10月26日 10:24」这种形式
    expect(name).toMatch(/^录音 · \d+月\d+日 \d{2}:\d{2}$/);
  });

  it('换语言后日期部分跟着变', () => {
    expect(buildRecordingName('Recording · ', 'en-US', new Date(2026, 9, 26, 10, 24).getTime())).toBe(
      'Recording · Oct 26, 10:24'
    );
    expect(buildRecordingName('录音 · ', 'zh-CN', new Date(2026, 9, 26, 10, 24).getTime())).toBe(
      '录音 · 10月26日 10:24'
    );
  });
});
