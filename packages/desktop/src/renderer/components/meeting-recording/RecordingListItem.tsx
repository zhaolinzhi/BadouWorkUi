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
  const [openAudioIndex, setOpenAudioIndex] = React.useState<number | null>(null);

  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        <span className={styles.name}>{recording.name}</span>
        <span className={styles.duration}>{formatMs(recording.durationMs)}</span>
        <Typography.Text type='secondary' className={styles.chunkCount}>
          {`${recording.chunks.length} chunks`}
        </Typography.Text>
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
      <div className={styles.chunks}>
        {recording.chunks.map((chunk) => {
          const isOpen = openAudioIndex === chunk.index;
          const audioId = `audio-${recording.id}-${chunk.index}`;
          return (
            <div key={chunk.index} className={styles.chunk}>
              <div className={styles.chunkMeta}>
                <Button
                  size='mini'
                  onClick={() => setOpenAudioIndex(isOpen ? null : chunk.index)}
                  aria-expanded={isOpen}
                  aria-controls={audioId}
                >
                  {isOpen ? '▼' : '▶'}
                </Button>
                <span className={styles.chunkLabel}>
                  {t('meeting-recording.chunkLabel', { index: chunk.index + 1 })}
                </span>
                <span className={styles.chunkDuration}>{formatMs(chunk.durationMs)}</span>
              </div>
              {isOpen ? (
                <audio
                  id={audioId}
                  data-testid={audioId}
                  className={styles.audio}
                  controls
                  src={chunk.audioUrl}
                />
              ) : null}
              <Typography.Text type='secondary' className={styles.transcript}>
                {chunk.status === 'transcribed'
                  ? chunk.transcription || t('meeting-recording.transcriptionPending')
                  : chunk.status === 'failed'
                    ? t('meeting-recording.transcriptionFailed')
                    : t('meeting-recording.transcriptionPending')}
              </Typography.Text>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecordingListItem;