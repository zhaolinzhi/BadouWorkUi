/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Typography } from '@arco-design/web-react';
import type { MeetingRecording } from '@/common/types/meetingRecording';
import { buildTranscriptSummary } from './transcriptSummary';
import styles from './TranscriptSummaryModal.module.css';

interface TranscriptSummaryModalProps {
  recording: MeetingRecording;
  visible: boolean;
  onClose: () => void;
}

const formatMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const TranscriptSummaryModal: React.FC<TranscriptSummaryModalProps> = ({ recording, visible, onClose }) => {
  const { t } = useTranslation();
  const summary = useMemo(() => buildTranscriptSummary(recording), [recording]);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      title={recording.name}
      okText={t('common.close')}
      cancelText={t('common.cancel')}
      className={styles.modal}
    >
      <Typography.Text type='secondary' className={styles.statusLine}>
        {t('meeting-recording.transcriptModal.statusLine', {
          total: recording.chunks.length,
          transcribed: summary.transcribedCount,
          failed: summary.failedCount,
          pending: summary.pendingCount,
        })}
      </Typography.Text>
      <Typography.Paragraph className={styles.body} copyable>
        {summary.text || t('meeting-recording.transcriptModal.disabledHint')}
      </Typography.Paragraph>
      <Typography.Text type='secondary' className={styles.footer}>
        {summary.chunks.map((c) => (
          <React.Fragment key={c.index}>
            <span>
              {t('meeting-recording.chunkLabel', { index: c.index + 1 })} {formatMs(c.durationMs)}
            </span>
            <span className={styles.separator}>{t('meeting-recording.transcriptModal.footerSeparator')}</span>
          </React.Fragment>
        ))}
      </Typography.Text>
    </Modal>
  );
};

export default TranscriptSummaryModal;
