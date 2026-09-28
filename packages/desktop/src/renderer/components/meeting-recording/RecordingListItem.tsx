/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Typography } from '@arco-design/web-react';
import { Delete } from '@icon-park/react';
import type { MeetingRecording } from '@/common/types/meetingRecording';
import styles from './RecordingList.module.css';

interface RecordingListItemProps {
  recording: MeetingRecording;
  onDelete: (id: string) => void;
}

const formatMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString()
    .padStart(2, '0');
  return `${m}:${s}`;
};

const RecordingListItem: React.FC<RecordingListItemProps> = ({ recording, onDelete }) => {
  const { t } = useTranslation();
  const [showAudio, setShowAudio] = React.useState(false);

  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        <Button
          size='mini'
          onClick={() => setShowAudio((v) => !v)}
          aria-expanded={showAudio}
          aria-controls={`audio-${recording.id}`}
        >
          {showAudio ? '▼' : '▶'}
        </Button>
        <span className={styles.name}>{recording.name}</span>
        <span className={styles.duration}>{formatMs(recording.durationMs)}</span>
        <Popconfirm
          title={t('meeting-recording.deleteConfirm')}
          okText='OK'
          cancelText='Cancel'
          onOk={() => onDelete(recording.id)}
        >
          <Button
            size='mini'
            status='danger'
            type='text'
            icon={<Delete theme='outline' size='14' fill='currentColor' />}
            aria-label='Delete'
          />
        </Popconfirm>
      </div>
      {showAudio ? (
        <audio id={`audio-${recording.id}`} className={styles.audio} controls src={recording.audioUrl} />
      ) : null}
      <Typography.Text type='secondary' className={styles.transcript}>
        {recording.transcription || t('meeting-recording.transcriptionPending')}
      </Typography.Text>
    </div>
  );
};

export default RecordingListItem;