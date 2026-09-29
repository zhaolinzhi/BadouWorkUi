/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Typography } from '@arco-design/web-react';
import { Delete } from '@icon-park/react';
import { ipcBridge } from '@/common';
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

const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

const RecordingListItem: React.FC<RecordingListItemProps> = ({ recording, onDelete }) => {
  const { t } = useTranslation();
  const [openAudioIndex, setOpenAudioIndex] = React.useState<number | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [audioLoading, setAudioLoading] = React.useState(false);

  // Load chunk bytes lazily — only when the user clicks play. The IPC
  // returns base64 because the bridge channel is JSON-encoded; we turn it
  // into a blob URL so `<audio>` can stream it without a `file://` source.
  const toggleAudio = React.useCallback(
    async (chunkIndex: number) => {
      if (openAudioIndex === chunkIndex) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setOpenAudioIndex(null);
        setAudioError(null);
        return;
      }
      setAudioError(null);
      setAudioLoading(true);
      setOpenAudioIndex(chunkIndex);
      try {
        const { base64, mimeType } = await ipcBridge.meetingRecording.readChunk.invoke({
          id: recording.id,
          chunkIndex,
        });
        const url = base64ToBlobUrl(base64, mimeType);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (error) {
        setAudioError(error instanceof Error ? error.message : String(error));
        setOpenAudioIndex(null);
      } finally {
        setAudioLoading(false);
      }
    },
    [audioUrl, openAudioIndex, recording.id]
  );

  React.useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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
                  onClick={() => toggleAudio(chunk.index)}
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
                audioError ? (
                  <Typography.Text type='warning'>{audioError}</Typography.Text>
                ) : audioUrl ? (
                  <audio
                    id={audioId}
                    data-testid={audioId}
                    className={styles.audio}
                    controls
                    src={audioUrl}
                  />
                ) : (
                  <Typography.Text type='secondary'>{audioLoading ? '…' : 'loading'}</Typography.Text>
                )
              ) : null}
              <Typography.Text type='secondary' className={styles.transcript}>
                {chunk.status === 'transcribed'
                  ? chunk.transcription || t('meeting-recording.transcriptionPending')
                  : chunk.status === 'failed'
                    ? chunk.error
                      ? `${t('meeting-recording.transcriptionFailed')} (${chunk.error})`
                      : t('meeting-recording.transcriptionFailed')
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