/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 录音名的日期部分 —— 「10月26日 10:24」这种形式。
 *
 * 走 `Intl.DateTimeFormat`,跟随当前界面语言:zh-CN 下是「10月26日 10:24」,
 * en-US 下是「Oct 26, 10:24」。语言未知时(独立运行时没有 shell 的 i18n 实例)
 * 退回系统语言。
 */
export const formatRecordingDate = (timestamp: number, locale?: string): string =>
  new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    // h23 而不是 hour12:false —— 后者在午夜会输出「24:00」。
    hourCycle: 'h23',
  }).format(timestamp);

/**
 * 拼出完整的自动录音名 —— 前缀(「录音 · 」)来自 i18n,日期部分跟语言走。
 */
export const buildRecordingName = (prefix: string, locale?: string, timestamp: number = Date.now()): string =>
  `${prefix}${formatRecordingDate(timestamp, locale)}`;

export type RecordingNameBuilder = {
  /** 生成当前时刻的默认录音名。 */
  buildDefaultName: () => string;
};

/**
 * 自动录音名的构造器。
 *
 * 之所以做成「函数」而不是一个值:默认名带当前时间,必须在**用到的时刻**才生成 ——
 * 弹窗打开时算一次就够了,组件每次渲染都算会得到新的字符串。
 */
export const useRecordingName = (): RecordingNameBuilder => {
  const { t, i18n } = useTranslation();
  const rawPrefix = t('meeting-recording.settings.autoNamePrefix', { defaultValue: '录音 · ' });
  const prefix = typeof rawPrefix === 'string' ? rawPrefix : '录音 · ';
  const locale = i18n?.language;

  return useMemo(
    () => ({
      buildDefaultName: () => buildRecordingName(prefix, locale),
    }),
    [prefix, locale]
  );
};
