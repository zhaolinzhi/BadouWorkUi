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

  const handleRecorded = useCallback(
    async (id: string) => {
      await refresh();
      if (!recordings.some((r) => r.id === id)) {
        console.warn('Recording', id, 'was saved but not returned by list()');
      }
    },
    [refresh, recordings]
  );

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