/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import RecordingListItem from './RecordingListItem';
import type { MeetingRecording } from '@common/types/meetingRecording';
import styles from './RecordingList.module.css';

interface RecordingListProps {
  recordings: MeetingRecording[];
  loading: boolean;
  autoOpenId: string | null;
  onAutoOpenConsumed: () => void;
  onDelete: (id: string) => void;
}

const RecordingList: React.FC<RecordingListProps> = ({
  recordings,
  loading,
  onDelete,
  autoOpenId,
  onAutoOpenConsumed,
}) => {
  if (loading && recordings.length === 0) {
    return <div className={styles.empty}>Loading…</div>;
  }

  if (recordings.length === 0) {
    return <div className={styles.empty}>No recordings yet.</div>;
  }

  return (
    <div className={styles.list}>
      {recordings.map((rec) => (
        <RecordingListItem
          key={rec.id}
          recording={rec}
          onDelete={onDelete}
          autoOpenTranscript={autoOpenId === rec.id}
          onAutoOpenConsumed={onAutoOpenConsumed}
        />
      ))}
    </div>
  );
};

export default RecordingList;
