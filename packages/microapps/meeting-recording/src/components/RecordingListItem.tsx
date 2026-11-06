/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon, ConfirmModal, MoreMenu, type MoreMenuItem } from '@aionui/ui';
import { Button, Tooltip, Typography } from '@arco-design/web-react';
import { ipcBridge } from '../__qiankun__/ipc';
import type { MeetingRecording } from '@common/types/meetingRecording';
import { buildTranscriptSummary } from './transcriptSummary';
import TranscriptSummaryModal from './TranscriptSummaryModal';
import styles from './RecordingListItem.module.css';

interface RecordingListItemProps {
  recording: MeetingRecording;
  onDelete: (id: string) => void;
}

/**
 * i18next 的插值只在接管了 shell 的 i18n 实例时生效;独立运行时 `t()` 只会
 * 原样返回 defaultValue,占位符会裸露在界面上。这里兜底替换一次 ——
 * 已经插值好的文案不含占位符,替换是空操作。
 */
const interpolate = (text: string, values: Record<string, string>): string =>
  Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value), text);

/** `t()` 的最小签名 —— 只用到 key 与选项,方便单测直接塞一个假函数。 */
type TFunctionLike = (key: string, opts?: Record<string, unknown>) => string;

/** 时长:「8分32秒」 */
export const formatDuration = (ms: number, t: TFunctionLike): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return interpolate(t('meeting-recording.duration', { defaultValue: '{{minutes}}分{{seconds}}秒' }), {
    minutes: String(minutes),
    seconds,
  });
};

/** 录制时间:今天/昨天显示「HH:mm」,更早显示「月日 HH:mm」。 */
export const formatCreatedAt = (createdAt: number, locale: string | undefined, t: TFunctionLike): string => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  if (createdAt >= startOfToday) {
    return `${interpolate(t('meeting-recording.today', { defaultValue: '今天' }), {})} ${time}`;
  }
  if (createdAt >= startOfToday - 24 * 60 * 60 * 1000) {
    return `${interpolate(t('meeting-recording.yesterday', { defaultValue: '昨天' }), {})} ${time}`;
  }
  try {
    // `month: 'long'` 出来是「1月1日」(zh-CN)这种设计稿里的写法;
    // `numeric` 在中文下会变成「1/1」。
    return `${date.toLocaleDateString(locale, { month: 'long', day: 'numeric' })} ${time}`;
  } catch {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
  }
};

const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

/**
 * 录音列表的一行 —— 设计稿的 `.rec-table-row`:
 * 名称(播放方块 + 标题 + 副标题)/ 时长 / 录制时间 / 状态 / 操作。
 */
const RecordingListItem: React.FC<RecordingListItemProps> = ({ recording, onDelete }) => {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const [openAudioIndex, setOpenAudioIndex] = React.useState<number | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [audioLoading, setAudioLoading] = React.useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isCancelOpen, setIsCancelOpen] = React.useState(false);
  const summary = React.useMemo(() => buildTranscriptSummary(recording), [recording]);
  // Retry-transcribe is useful only when something didn't finish successfully.
  // The main-process walker skips already-transcribed chunks, so re-clicking
  // when everything is done is a cheap no-op — but we still gate the menu item
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

  const statusText = React.useMemo(() => {
    if (summary.transcribedCount > 0) {
      return t('meeting-recording.statusSummaryReady', { defaultValue: '已生成纪要' });
    }
    if (recording.chunks.some((c) => c.status === 'failed')) {
      return t('meeting-recording.statusFailed', { defaultValue: '转写失败' });
    }
    return t('meeting-recording.statusPending', { defaultValue: '等待转写' });
  }, [recording.chunks, summary.transcribedCount, t]);

  const handleRetryTranscribe = React.useCallback(() => {
    setIsRetrying(true);
    void ipcBridge.meetingRecording.transcribe.invoke({ id: recording.id });
  }, [recording.id]);

  const menuItems = React.useMemo(() => {
    const items: MoreMenuItem[] = [
      {
        key: 'retry',
        label: t('meeting-recording.transcriptModal.retryTranscribeButtonAriaLabel', {
          defaultValue: '重新转写',
        }),
        icon: (
          <span
            data-testid='retry-transcribe-spin'
            className={showRetrySpinner ? `${styles.spin} microapp-meeting-recording-spin` : undefined}
          >
            <AppIcon name='refresh' size={14} />
          </span>
        ),
        disabled: !canRetryTranscribe || isRetrying,
        testId: 'retry-transcribe-button',
      },
    ];
    // 重试进行中时,菜单里多一项「停止转写」——原来它是挂在重试按钮上的
    // Popconfirm,收进菜单后入口不变,只是位置换了个地方。
    if (isRetrying) {
      items.push({
        key: 'cancel',
        label: t('meeting-recording.transcriptModal.cancelTranscribeConfirmOk', { defaultValue: '停止' }),
        testId: 'cancel-transcribe-button',
      });
    }
    items.push({
      key: 'delete',
      label: t('meeting-recording.deleteAction', { defaultValue: '删除' }),
      icon: <AppIcon name='delete' size={14} />,
      danger: true,
      testId: 'delete-recording-button',
    });
    return items;
  }, [canRetryTranscribe, isRetrying, showRetrySpinner, t]);

  return (
    <div>
      <div className={styles.row} role='row'>
        <div className={styles.nameCell}>
          {/*
            左侧方块沿用设计稿的「播放」造型,但我们的数据是分片的 ——
            点击展开该录音的分片明细(播放 + 转写文本)。
          */}
          <Button
            type='text'
            className={styles.symbol}
            aria-expanded={expanded}
            aria-label={t('meeting-recording.toggleChunks', { defaultValue: '展开分片' })}
            onClick={() => setExpanded((value) => !value)}
            data-testid='toggle-chunks-button'
          >
            <AppIcon name='play' size={14} />
          </Button>
          <div className={styles.copy}>
            <span className={styles.name}>{recording.name}</span>
            <span className={styles.subtitle}>
              {t('meeting-recording.sourceSubtitle', { defaultValue: '麦克风与系统声音' })}
            </span>
          </div>
        </div>
        <span className={styles.duration}>{formatDuration(recording.durationMs, t)}</span>
        <span className={styles.createdAt}>{formatCreatedAt(recording.createdAt, i18n?.language, t)}</span>
        <span className={styles.status}>{statusText}</span>
        <div className={styles.actions}>
          <Tooltip
            disabled={summary.transcribedCount > 0}
            content={t('meeting-recording.transcriptModal.disabledHint', {
              defaultValue: '还没有可汇总的转写结果',
            })}
          >
            <Button
              type='text'
              className={styles.viewButton}
              disabled={summary.transcribedCount === 0}
              onClick={() => setIsTranscriptOpen(true)}
              data-testid='transcript-view-button'
            >
              {t('meeting-recording.viewAction', { defaultValue: '查看' })}
            </Button>
          </Tooltip>
          <MoreMenu
            label={t('meeting-recording.moreActions', { defaultValue: '更多操作' })}
            onClick={(event) => event.stopPropagation()}
            onSelect={(key) => {
              if (key === 'retry') handleRetryTranscribe();
              if (key === 'cancel') setIsCancelOpen(true);
              if (key === 'delete') setIsDeleteOpen(true);
            }}
            items={menuItems}
            className={styles.moreButton}
            data-testid='recording-more-menu'
          />
        </div>
      </div>

      {expanded ? (
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
                    {t('meeting-recording.chunkLabel', {
                      index: chunk.index + 1,
                      // 兜底文案自己拼好序号:standalone 没有 i18n 实例,
                      // react-i18next 的 not-ready 分支直接返回 defaultValue,
                      // 不会做 `{{index}}` 插值。
                      defaultValue: `Chunk ${chunk.index + 1}`,
                    })}
                  </span>
                  <span className={styles.chunkDuration}>{formatDuration(chunk.durationMs, t)}</span>
                </div>
                {isOpen ? (
                  audioError ? (
                    <Typography.Text type='warning'>{audioError}</Typography.Text>
                  ) : audioUrl ? (
                    <audio id={audioId} data-testid={audioId} className={styles.audio} controls src={audioUrl} />
                  ) : (
                    <Typography.Text type='secondary'>{audioLoading ? '…' : 'loading'}</Typography.Text>
                  )
                ) : null}
                <Typography.Text type='secondary' className={styles.transcript}>
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
      ) : null}

      <TranscriptSummaryModal
        recording={recording}
        visible={isTranscriptOpen}
        onClose={() => setIsTranscriptOpen(false)}
      />
      <ConfirmModal
        visible={isCancelOpen}
        title={t('meeting-recording.transcriptModal.cancelTranscribeConfirmTitle', {
          defaultValue: '确定停止转写吗?',
        })}
        description={t('meeting-recording.transcriptModal.cancelTranscribeConfirmDescription', {
          defaultValue: '停止后,尚未完成的片段将不再转写。',
        })}
        okText={t('meeting-recording.transcriptModal.cancelTranscribeConfirmOk', { defaultValue: '停止' })}
        cancelText={t('meeting-recording.transcriptModal.cancelTranscribeConfirmCancel', {
          defaultValue: '继续转写',
        })}
        onCancel={() => setIsCancelOpen(false)}
        onOk={() => {
          setIsCancelOpen(false);
          setIsRetrying(false);
          void ipcBridge.meetingRecording.cancelTranscribe.invoke({ id: recording.id });
        }}
      />
      <ConfirmModal
        visible={isDeleteOpen}
        title={t('meeting-recording.deleteConfirmTitle', { defaultValue: '删除这条录音？' })}
        description={t('meeting-recording.deleteConfirm', {
          defaultValue: '确认删除此录音?删除后无法恢复。',
        })}
        okText={t('common.delete', { defaultValue: 'Delete' })}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        danger
        onCancel={() => setIsDeleteOpen(false)}
        onOk={() => {
          setIsDeleteOpen(false);
          onDelete(recording.id);
        }}
      />
    </div>
  );
};

export default RecordingListItem;
