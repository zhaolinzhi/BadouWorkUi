/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Spin } from '@arco-design/web-react';
import { Microphone, Record } from '@icon-park/react';
import {
  useMeetingRecorder,
  type MeetingRecorderErrorCode,
} from '@renderer/hooks/meeting-recording/useMeetingRecorder';
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

interface RecorderPanelProps {
  onRecorded?: (recordingId: string) => void;
}

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
  const isFinalizing = status === 'finalizing';

  return (
    <div className={styles.panel}>
      <Button
        shape='circle'
        size='large'
        type={isRecording ? 'outline' : 'primary'}
        onClick={handleClick}
        disabled={isFinalizing}
        aria-label={isRecording ? t('meeting-recording.stopRecording') : t('meeting-recording.startRecording')}
      >
        <span className={isRecording ? styles.pulse : undefined}>
          {isFinalizing ? (
            <Spin />
          ) : isRecording ? (
            <Record theme='outline' size='22' fill='currentColor' />
          ) : (
            <Microphone theme='outline' size='22' fill='currentColor' />
          )}
        </span>
      </Button>
      {status === 'recording' || status === 'finalizing' ? (
        <div className={styles.timer} aria-live='polite'>
          {formatMs(durationMs)}
        </div>
      ) : null}
      {errorCode ? (
        <div className={styles.error} role='alert'>
          {t(`meeting-recording.errors.${errorKey(errorCode)}` as never)}
        </div>
      ) : null}
    </div>
  );
};

export default RecorderPanel;
