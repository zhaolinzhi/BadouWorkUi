/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MeetingRecording } from '@/common/types/meetingRecording';
import RecordingListItem from './RecordingListItem';
import styles from './RecordingList.module.css';

interface RecordingListProps {
  recordings: MeetingRecording[];
  onDelete: (id: string) => void;
  loading: boolean;
}

const RecordingList: React.FC<RecordingListProps> = ({ recordings, onDelete, loading }) => {
  const { t } = useTranslation();

  if (!loading && recordings.length === 0) {
    return <div className={styles.empty}>{t('meeting-recording.empty')}</div>;
  }

  return (
    <div className={styles.list}>
      {recordings.map((recording) => (
        <RecordingListItem key={recording.id} recording={recording} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default RecordingList;