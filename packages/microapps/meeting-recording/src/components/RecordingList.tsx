/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon, AsyncBoundary, EmptyState } from '@aionui/ui';
import RecordingListItem from './RecordingListItem';
import type { MeetingRecording } from '@common/types/meetingRecording';
import styles from './RecordingList.module.css';

interface RecordingListProps {
  recordings: MeetingRecording[];
  loading: boolean;
  onDelete: (id: string) => void;
}

/**
 * 录音列表 —— 设计稿里是一张表:灰底圆角的表头 + 五列的录音行。
 */
const RecordingList: React.FC<RecordingListProps> = ({ recordings, onDelete, loading }) => {
  const { t } = useTranslation();

  return (
    <AsyncBoundary
      loading={loading}
      isEmpty={recordings.length === 0}
      emptyContent={
        <div className={styles.empty}>
          <EmptyState
            icon={<AppIcon name='recording' size={40} />}
            title={t('meeting-recording.empty', { defaultValue: '暂无录音' })}
          />
        </div>
      }
    >
      <div className={styles.table} role='table'>
        <div className={styles.head} role='row'>
          <span role='columnheader'>{t('meeting-recording.columnName', { defaultValue: '录音名称' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnDuration', { defaultValue: '时长' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnCreatedAt', { defaultValue: '录制时间' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnStatus', { defaultValue: '状态' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnActions', { defaultValue: '操作' })}</span>
        </div>
        {recordings.map((recording) => (
          <RecordingListItem key={recording.id} recording={recording} onDelete={onDelete} />
        ))}
      </div>
    </AsyncBoundary>
  );
};

export default RecordingList;
