/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AsyncBoundary } from '@aionui/ui';
import RecordingListItem from './RecordingListItem';
import type { MeetingRecording } from '@common/types/meetingRecording';
import styles from './RecordingList.module.css';

interface RecordingListProps {
  recordings: MeetingRecording[];
  loading: boolean;
  onDelete: (id: string) => void;
  /**
   * 一条都没匹配上时的空结果块(搜索无结果)。
   *
   * 设计稿里搜索无结果时**表头是保留的** —— 下面才是那块 540px 高的居中空态,
   * 所以这个内容渲染在表头**之后**,而不是像整表空态那样把表头一起换掉。
   */
  emptyContent?: React.ReactNode;
}

/**
 * 录音列表 —— 设计稿里是一张表:灰底圆角的表头 + 五列的录音行。
 *
 * 「一条录音都没有」与「搜索没匹配上」是两种不同的空态,前者由页面整个换成
 * 设计稿的空态版式(见 `RecordingListPage`),后者才走这里的 `emptyContent`。
 */
const RecordingList: React.FC<RecordingListProps> = ({ recordings, onDelete, loading, emptyContent }) => {
  const { t } = useTranslation();

  /** 空结果块存在时,表格要占满内容区 —— 空态块自己吃掉剩余高度。 */
  const hasEmptyContent = recordings.length === 0 && emptyContent !== null && emptyContent !== undefined;

  return (
    <AsyncBoundary loading={loading}>
      <div className={hasEmptyContent ? `${styles.table} ${styles.tableEmpty}` : styles.table} role='table'>
        <div className={styles.head} role='row'>
          <span role='columnheader'>{t('meeting-recording.columnName', { defaultValue: '录音名称' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnDuration', { defaultValue: '时长' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnCreatedAt', { defaultValue: '录制时间' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnStatus', { defaultValue: '状态' })}</span>
          <span role='columnheader'>{t('meeting-recording.columnActions', { defaultValue: '操作' })}</span>
        </div>
        {recordings.length > 0 ? (
          recordings.map((recording) => (
            <RecordingListItem key={recording.id} recording={recording} onDelete={onDelete} />
          ))
        ) : (
          /*
            空结果块不是表格的一行 —— 用 `presentation` 把它从 table 的语义里
            摘出去,但里面的标题、说明与按钮照常暴露给辅助技术。
          */
          <div role='presentation' className={styles.emptyBody} data-testid='recording-empty-body'>
            {emptyContent}
          </div>
        )}
      </div>
    </AsyncBoundary>
  );
};

export default RecordingList;
