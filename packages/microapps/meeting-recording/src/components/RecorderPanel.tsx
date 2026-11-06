/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import { Button, Spin } from '@arco-design/web-react';
import { useMeetingRecorder, type MeetingRecorderErrorCode } from '../hooks/useMeetingRecorder';
import styles from './RecorderPanel.module.css';

const formatMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const errorKey = (code: MeetingRecorderErrorCode): string => {
  switch (code) {
    case 'permission-denied':
      return 'permissionDenied';
    case 'no-device':
      return 'noDevice';
    case 'recording-unsupported':
      return 'recordingUnsupported';
    case 'save-failed':
      return 'saveFailed';
    case 'unknown':
    default:
      return 'unknown';
  }
};

/**
 * 错误码 → 英文兜底文案。
 *
 * 与 shell 的 `en-US/meeting-recording.json` 一致。standalone(没有 shell 的
 * i18n 实例)时 react-i18next 走 not-ready 分支,只认 `defaultValue` ——
 * 没有兜底的话页面上就是原始 key。
 */
const ERROR_TEXT: Record<MeetingRecorderErrorCode, string> = {
  'permission-denied': 'Microphone access denied',
  'no-device': 'No microphone detected',
  'recording-unsupported': 'Recording is not supported in this environment',
  'save-failed': 'Failed to save recording',
  unknown: 'Unknown error',
};

interface RecorderPanelProps {
  onRecorded?: (recordingId: string) => void;
}

/**
 * 录音开关 —— 设计稿里是页头右上角的「开始录音」主按钮(36px 高、蓝底白字),
 * 录音中切成浅蓝底的「停止」,旁边跟一个计时。
 */
const RecorderPanel: React.FC<RecorderPanelProps> = ({ onRecorded }) => {
  const { t } = useTranslation();
  const { status, durationMs, errorCode, start, stop } = useMeetingRecorder();

  const handleClick = async () => {
    if (status === 'idle' || status === 'error') {
      await start();
      return;
    }
    if (status === 'recording') {
      const result = await stop();
      if (result && onRecorded) onRecorded(result.id);
    }
  };

  const isRecording = status === 'recording';
  const isBusy = status === 'requesting' || status === 'finalizing';
  const stopLabel = t('meeting-recording.stopRecording', { defaultValue: '停止' });
  const startLabel = t('meeting-recording.startRecording', { defaultValue: '开始录音' });

  return (
    <div className={styles.panel}>
      <Button
        className={isRecording ? styles.stopButton : styles.startButton}
        onClick={handleClick}
        disabled={isBusy}
        aria-label={isRecording ? stopLabel : startLabel}
      >
        {isBusy ? (
          <Spin size={16} />
        ) : (
          <>
            <AppIcon name={isRecording ? 'record' : 'microphone'} size={16} />
            {isRecording ? stopLabel : startLabel}
          </>
        )}
      </Button>
      {isRecording || status === 'finalizing' ? (
        <span className={styles.timer} aria-live='polite'>
          {formatMs(durationMs)}
        </span>
      ) : null}
      {errorCode ? (
        <span className={styles.error} role='alert'>
          {t(`meeting-recording.errors.${errorKey(errorCode)}` as never, { defaultValue: ERROR_TEXT[errorCode] })}
        </span>
      ) : null}
    </div>
  );
};

export default RecorderPanel;
