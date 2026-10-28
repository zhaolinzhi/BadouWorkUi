/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Tooltip, Typography } from '@arco-design/web-react';
import { Delete, FileText, Refresh } from '@icon-park/react';
import { ipcBridge } from '../__qiankun__/ipc';
import type { MeetingRecording } from '@common/types/meetingRecording';
import { buildTranscriptSummary } from './transcriptSummary';
import TranscriptSummaryModal from './TranscriptSummaryModal';

interface RecordingListItemProps {
  recording: MeetingRecording;
  onDelete: (id: string) => void;
}

const formatMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
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
  const [isTranscriptOpen, setIsTranscriptOpen] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const summary = React.useMemo(() => buildTranscriptSummary(recording), [recording]);
  // Retry-transcribe is useful only when something didn't finish successfully.
  // The main-process walker skips already-transcribed chunks, so re-clicking
  // when everything is done is a cheap no-op — but we still gate the button
  // so the affordance reflects "there is work to retry".
  const canRetryTranscribe = recording.chunks.some((c) => c.status === 'pending' || c.status === 'failed');
  // Track the click-driven retry separately from "is there anything to
  // retry": we want the spinner to stay on until the user-acknowledged
  // request has visibly drained all pending/failed chunks, even if the
  // chunkTranscribed events arrive one at a time.
  const hasUnfinishedChunk = recording.chunks.some((c) => c.status === 'pending' || c.status === 'failed');
  const showRetrySpinner = isRetrying && hasUnfinishedChunk;

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
    <div className='microapp-meeting-recording-row'>
      <div className='microapp-meeting-recording-meta'>
        <span className='microapp-meeting-recording-name'>{recording.name}</span>
        <span className='microapp-meeting-recording-duration'>{formatMs(recording.durationMs)}</span>
        <Typography.Text type='secondary' className='microapp-meeting-recording-chunk-count'>
          {`${recording.chunks.length} chunks`}
        </Typography.Text>
        <Tooltip
          disabled={summary.transcribedCount > 0}
          content={t('meeting-recording.transcriptModal.disabledHint', {
            defaultValue: 'No transcriptions available yet',
          })}
        >
          <Button
            size='mini'
            type='text'
            icon={<FileText theme='outline' size='14' fill='currentColor' />}
            aria-label={t('meeting-recording.transcriptModal.viewButtonAriaLabel', {
              defaultValue: 'View transcript summary',
            })}
            disabled={summary.transcribedCount === 0}
            onClick={() => setIsTranscriptOpen(true)}
            data-testid='transcript-view-button'
          />
        </Tooltip>
        <Popconfirm
          disabled={!isRetrying}
          title={t('meeting-recording.transcriptModal.cancelTranscribeConfirmTitle', {
            defaultValue: 'Stop transcription?',
          })}
          okText={t('meeting-recording.transcriptModal.cancelTranscribeConfirmOk', { defaultValue: 'Stop' })}
          cancelText={t('meeting-recording.transcriptModal.cancelTranscribeConfirmCancel', {
            defaultValue: 'Keep going',
          })}
          onOk={() => {
            setIsRetrying(false);
            void ipcBridge.meetingRecording.cancelTranscribe.invoke({ id: recording.id });
          }}
        >
          <Tooltip
            disabled={canRetryTranscribe}
            content={t('meeting-recording.transcriptModal.retryTranscribeDisabledHint', {
              defaultValue: 'All chunks have been transcribed; nothing to retry',
            })}
          >
            <Button
              size='mini'
              type='text'
              icon={
                <span
                  data-testid='retry-transcribe-spin'
                  className={showRetrySpinner ? 'microapp-meeting-recording-spin' : undefined}
                >
                  <Refresh theme='outline' size='14' fill='currentColor' />
                </span>
              }
              aria-label={t('meeting-recording.transcriptModal.retryTranscribeButtonAriaLabel', {
                defaultValue: 'Retry transcription',
              })}
              disabled={!canRetryTranscribe}
              onClick={() => {
                // While a retry is already in flight, the surrounding
                // Popconfirm is what should react to this click — its
                // confirm handler cancels via the IPC. Skip the
                // transcribe.invoke call here so we don't queue a second
                // walker on top of the running one.
                if (isRetrying) return;
                setIsRetrying(true);
                void ipcBridge.meetingRecording.transcribe.invoke({ id: recording.id });
              }}
              data-testid='retry-transcribe-button'
            />
          </Tooltip>
        </Popconfirm>
        <Popconfirm
          title={t('meeting-recording.deleteConfirm', {
            defaultValue: 'Delete this recording? This cannot be undone.',
          })}
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
      <div className='microapp-meeting-recording-chunks'>
        {recording.chunks.map((chunk) => {
          const isOpen = openAudioIndex === chunk.index;
          const audioId = `audio-${recording.id}-${chunk.index}`;
          return (
            <div key={chunk.index} className='microapp-meeting-recording-chunk'>
              <div className='microapp-meeting-recording-chunk-meta'>
                <Button
                  size='mini'
                  onClick={() => toggleAudio(chunk.index)}
                  aria-expanded={isOpen}
                  aria-controls={audioId}
                >
                  {isOpen ? '▼' : '▶'}
                </Button>
                <span className='microapp-meeting-recording-chunk-label'>
                  {t('meeting-recording.chunkLabel', {
                    index: chunk.index + 1,
                    // 兜底文案自己拼好序号:standalone 没有 i18n 实例,
                    // react-i18next 的 not-ready 分支直接返回 defaultValue,
                    // 不会做 `{{index}}` 插值。
                    defaultValue: `Chunk ${chunk.index + 1}`,
                  })}
                </span>
                <span className='microapp-meeting-recording-chunk-duration'>{formatMs(chunk.durationMs)}</span>
              </div>
              {isOpen ? (
                audioError ? (
                  <Typography.Text type='warning'>{audioError}</Typography.Text>
                ) : audioUrl ? (
                  <audio
                    id={audioId}
                    data-testid={audioId}
                    className='microapp-meeting-recording-audio'
                    controls
                    src={audioUrl}
                  />
                ) : (
                  <Typography.Text type='secondary'>{audioLoading ? '…' : 'loading'}</Typography.Text>
                )
              ) : null}
              <Typography.Text type='secondary' className='microapp-meeting-recording-transcript'>
                {chunk.status === 'transcribed'
                  ? chunk.transcription ||
                    t('meeting-recording.transcriptionPending', { defaultValue: 'Transcription pending' })
                  : chunk.status === 'failed'
                    ? chunk.error
                      ? `${t('meeting-recording.transcriptionFailed', { defaultValue: 'Transcription failed' })} (${chunk.error})`
                      : t('meeting-recording.transcriptionFailed', { defaultValue: 'Transcription failed' })
                    : t('meeting-recording.transcriptionPending', { defaultValue: 'Transcription pending' })}
              </Typography.Text>
            </div>
          );
        })}
      </div>
      <TranscriptSummaryModal
        recording={recording}
        visible={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
      />
    </div>
  );
};

export default RecordingListItem;
