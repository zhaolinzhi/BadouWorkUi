/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@arco-design/web-react';
import { ipcBridge } from '@/common';
import type { MeetingRecording } from '@/common/types/meetingRecording';
import RecorderPanel from '@renderer/components/meeting-recording/RecorderPanel';
import RecordingList from '@renderer/components/meeting-recording/RecordingList';
import styles from './MeetingRecordingPage.module.css';

const MeetingRecordingPage: React.FC = () => {
  const { t } = useTranslation();
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await ipcBridge.meetingRecording.list.invoke();
      setRecordings(list);
    } catch (error) {
      console.error('Failed to load recordings', error);
      Message.error(t('meeting-recording.errors.unknown' as never));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Subscribe to per-chunk transcription updates so the list reflects the
  // STT endpoint's progress without a manual refresh.
  useEffect(() => {
    const off = ipcBridge.meetingRecording.chunkTranscribed.on(({ id, chunkIndex, status }) => {
      setRecordings((current) =>
        current.map((rec) => {
          if (rec.id !== id) return rec;
          return {
            ...rec,
            chunks: rec.chunks.map((c) => (c.index === chunkIndex ? { ...c, status } : c)),
          };
        })
      );
    });
    return off;
  }, []);

  const handleRecorded = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      const previous = recordings;
      setRecordings((current) => current.filter((r) => r.id !== id));
      try {
        await ipcBridge.meetingRecording.delete.invoke({ id });
      } catch (error) {
        console.error('Delete failed', error);
        setRecordings(previous);
        Message.error(t('meeting-recording.errors.deleteFailed' as never));
      }
    },
    [recordings, t]
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('meeting-recording.title')}</h1>
      <RecorderPanel onRecorded={handleRecorded} />
      <RecordingList recordings={recordings} onDelete={handleDelete} loading={loading} />
    </div>
  );
};

export default MeetingRecordingPage;