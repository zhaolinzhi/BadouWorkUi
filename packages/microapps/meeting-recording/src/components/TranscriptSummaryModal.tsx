/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Typography } from '@arco-design/web-react';
import type { MeetingRecording } from '@common/types/meetingRecording';
import { buildTranscriptSummary } from './transcriptSummary';

interface TranscriptSummaryModalProps {
  recording: MeetingRecording;
  visible: boolean;
  onClose: () => void;
}

const TranscriptSummaryModal: React.FC<TranscriptSummaryModalProps> = ({ recording, visible, onClose }) => {
  const { t } = useTranslation();
  const summary = useMemo(() => buildTranscriptSummary(recording), [recording]);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      onOk={onClose}
      title={recording.name}
      okText={t('common.close', { defaultValue: 'Close' })}
      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
      className='microapp-meeting-recording-modal'
    >
      <Typography.Paragraph className='microapp-meeting-recording-modal-body' copyable>
        {summary.text ||
          t('meeting-recording.transcriptModal.disabledHint', { defaultValue: 'No transcriptions available yet' })}
      </Typography.Paragraph>
    </Modal>
  );
};

export default TranscriptSummaryModal;
