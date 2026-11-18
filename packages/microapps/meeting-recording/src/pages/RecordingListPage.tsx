/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Message } from '@arco-design/web-react';
import { AppIcon } from '@aionui/ui';
import { ipcBridge } from '../__qiankun__/ipc';
import type { MeetingRecording } from '../__qiankun__/ipc';
import RecorderPanel from '../components/RecorderPanel';
import RecordingList from '../components/RecordingList';
import { useMeetingRecorder } from '../hooks/useMeetingRecorder';
import RecordingEmptyState from './RecordingEmptyState';
import { recordingNoResultsIllustration } from './assets';
import styles from './RecordingListPage.module.css';

/**
 * i18next 的插值只在接管了 shell 的 i18n 实例时生效;独立运行时 `t()` 只会
 * 原样返回 defaultValue,`{{count}}` / `{{query}}` 会裸露在界面上。这里兜底替换
 * 一次 —— 已经插值好的文案不含占位符,替换是空操作。
 */
const interpolate = (text: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    text
  );

const RecordingListPage: React.FC = () => {
  const { t } = useTranslation();
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  // 录音机由页面持有 —— 空态里的录音面板、录音设置弹窗共用同一个实例。
  const recorder = useMeetingRecorder();

  const refresh = useCallback(async () => {
    try {
      const list = await ipcBridge.meetingRecording.list.invoke();
      setRecordings(list);
    } catch (error) {
      console.error('Failed to load recordings', error);
      Message.error(t('meeting-recording.errors.unknown', { defaultValue: 'Unknown error' }));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Subscribe to per-chunk transcription updates so the list reflects the
  // STT endpoint's progress without a manual refresh. We previously
  // tracked a "first-time-finished" transition here to auto-open the
  // transcript modal on the just-finished recording, but that UX was
  // removed — the user opens the modal themselves via the row button
  // when they want to read the transcript.
  useEffect(() => {
    const off = ipcBridge.meetingRecording.chunkTranscribed.on(({ id, chunkIndex, status, transcription, error }) => {
      setRecordings((current) =>
        current.map((rec) => {
          if (rec.id !== id) return rec;
          return {
            ...rec,
            chunks: rec.chunks.map((c) => {
              if (c.index !== chunkIndex) return c;
              // Merge only the fields the event actually carries. The
              // payload includes `transcription` on success and `error` on
              // failure; missing fields leave the prior chunk value intact
              // so a partial race doesn't blank out an earlier good result.
              return {
                ...c,
                status,
                ...(transcription !== undefined ? { transcription } : {}),
                ...(error !== undefined ? { error } : {}),
              };
            }),
          };
        })
      );
    });
    return off;
  }, []);

  const handleRecorded = useCallback(async () => {
    // Pull the freshly-saved recording from disk, but keep any
    // chunkTranscribed updates we've already applied so the row doesn't
    // flash back to 'pending' between save and the first emit.
    try {
      const list = await ipcBridge.meetingRecording.list.invoke();
      setRecordings((current) => {
        const byId = new Map(current.map((r) => [r.id, r]));
        return list.map((next) => {
          const prev = byId.get(next.id);
          if (!prev) return next;
          const prevByIndex = new Map(prev.chunks.map((c) => [c.index, c]));
          return {
            ...next,
            chunks: next.chunks.map((c) => {
              const prevChunk = prevByIndex.get(c.index);
              if (!prevChunk) return c;
              // Preserve a status that's already progressed beyond what
              // disk reports — disk only updates after the background
              // walker writes back, so refresh races behind the emit.
              if ((prevChunk.status === 'transcribed' || prevChunk.status === 'failed') && c.status === 'pending') {
                return {
                  ...c,
                  status: prevChunk.status,
                  error: prevChunk.error,
                  transcription: prevChunk.transcription,
                };
              }
              return c;
            }),
          };
        });
      });
    } catch (error) {
      console.error('Failed to refresh after record', error);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const previous = recordings;
      setRecordings((current) => current.filter((r) => r.id !== id));
      try {
        await ipcBridge.meetingRecording.delete.invoke({ id });
      } catch (error) {
        console.error('Delete failed', error);
        setRecordings(previous);
        Message.error(t('meeting-recording.errors.deleteFailed', { defaultValue: 'Failed to delete recording' }));
      }
    },
    [recordings, t]
  );

  /** 搜索在客户端做 —— 录音列表接口没有 `q` 参数。 */
  const query = keyword.trim();
  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    if (!needle) return recordings;
    return recordings.filter((recording) =>
      [recording.name, ...recording.chunks.map((chunk) => chunk.transcription ?? '')].some((field) =>
        field.toLowerCase().includes(needle)
      )
    );
  }, [recordings, query]);

  /** 有查询、但一条都没匹配上 —— 设计稿的「没有找到相关录音」空结果态。 */
  const showNoResults = query.length > 0 && filtered.length === 0;

  /** 清空搜索:搜索框上的叉号与空结果块里的「清空搜索」都走这里。 */
  const handleClearSearch = useCallback(() => setKeyword(''), []);

  /**
   * 还没有任何录音时,页面换成设计稿的 `record-empty` 版式:只留页头
   * (副标题换成空态那句)与居中的空态块,没有工具行、表格与底栏。
   */
  if (!loading && recordings.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.heading}>
          <div className={styles.headingCopy}>
            <h1 className={styles.title}>{t('meeting-recording.title', { defaultValue: '录音' })}</h1>
            <p className={styles.subtitle}>
              {t('meeting-recording.emptySubtitle', { defaultValue: '录下讨论，整理成纪要，也可以继续向 AI 提问' })}
            </p>
          </div>
        </header>
        <RecordingEmptyState recorder={recorder} onRecorded={handleRecorded} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingCopy}>
          <h1 className={styles.title}>{t('meeting-recording.title', { defaultValue: '录音' })}</h1>
          <p className={styles.subtitle}>
            {t('meeting-recording.subtitle', { defaultValue: '录音、转写与纪要集中管理，点击记录即可查看' })}
          </p>
        </div>
        <div className={styles.headingActions}>
          <RecorderPanel recorder={recorder} onRecorded={handleRecorded} />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.tools}>
          <div className={styles.tabs}>
            <Button type='text' className={styles.tab} aria-selected='true'>
              {interpolate(
                t('meeting-recording.tabAll', { count: recordings.length, defaultValue: '全部录音 {{count}}' }),
                { count: recordings.length }
              )}
            </Button>
          </div>
          <div className={styles.search}>
            {/*
              设计稿的放大镜有两套:没有查询时是深色的(#0D0D0D),有查询时
              换成灰色(#6F7680) —— 同一个语义、两种状态色。
            */}
            <AppIcon
              name='search'
              size={16}
              className={`${styles.searchIcon} ${query ? styles.searchIconMuted : styles.searchIconStrong}`}
            />
            <Input
              value={keyword}
              onChange={setKeyword}
              placeholder={t('meeting-recording.searchPlaceholder', {
                defaultValue: '搜索录音标题或转写内容',
              })}
              aria-label={t('meeting-recording.searchLabel', { defaultValue: '搜索录音' })}
              data-testid='recording-search'
            />
            {/*
              清除按钮是搜索框**外面**的一个 16px 圆形叉号(常显)——
              Arco 的 `allowClear` 是输入框内、hover 才出现的图标,不是设计稿那套。
            */}
            {query ? (
              <Button
                type='text'
                className={styles.searchClear}
                aria-label={t('meeting-recording.searchClear', { defaultValue: '清除录音搜索' })}
                onClick={handleClearSearch}
                data-testid='recording-search-clear'
              >
                <AppIcon name='close-small' size={12} strokeWidth={2} />
              </Button>
            ) : null}
          </div>
        </div>
        <RecordingList
          recordings={filtered}
          onDelete={handleDelete}
          loading={loading}
          emptyContent={
            showNoResults ? (
              <div className={styles.noResults} data-testid='recording-no-results'>
                <img className={styles.noResultsImage} src={recordingNoResultsIllustration} alt='' />
                <h2 className={styles.noResultsTitle}>
                  {t('meeting-recording.noResultsTitle', { defaultValue: '没有找到相关录音' })}
                </h2>
                <p className={styles.noResultsDescription}>
                  {interpolate(
                    t('meeting-recording.noResultsDescription', {
                      query,
                      defaultValue: '未找到与“{{query}}”匹配的标题或转写内容',
                    }),
                    { query }
                  )}
                </p>
                <Button
                  className={styles.noResultsAction}
                  onClick={handleClearSearch}
                  data-testid='recording-clear-search'
                >
                  {t('meeting-recording.clearSearch', { defaultValue: '清空搜索' })}
                </Button>
              </div>
            ) : null
          }
        />
      </div>

      <footer className={styles.footer}>
        <AppIcon name='check' size={12} className={styles.footerIcon} />
        {interpolate(
          t('meeting-recording.footerStatus', { count: recordings.length, defaultValue: '{{count}} 条录音 · 已同步' }),
          { count: recordings.length }
        )}
      </footer>
    </div>
  );
};

export default RecordingListPage;
