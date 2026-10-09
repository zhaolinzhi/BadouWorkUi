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
  // Tracks the recording id whose transcript modal should auto-open on the
  // next render. We intentionally do NOT auto-open on mount for already-
  // finished recordings — only when a recording *transitions* to fully
  // terminal during this session. This avoids the "open the page and 12
  // modals pop up" UX bug from historical data.
  const [autoOpenId, setAutoOpenId] = useState<string | null>(null);

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

  // Subscribe to per-chunk transcription updates so the list reflects the
  // STT endpoint's progress without a manual refresh.
  useEffect(() => {
    const off = ipcBridge.meetingRecording.chunkTranscribed.on(({ id, chunkIndex, status, transcription, error }) => {
      // We need both the previous chunks (to detect the "just-finished"
      // transition) and the next chunks (to write back). Using a
      // functional updater lets us compute both inside one render cycle.
      let shouldAutoOpen = false;
      setRecordings((current) =>
        current.map((rec) => {
          if (rec.id !== id) return rec;
          const wasAllTerminal =
            rec.chunks.length > 0 && rec.chunks.every((c) => c.status === 'transcribed' || c.status === 'failed');
          const nextChunks = rec.chunks.map((c) => {
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
          });
          const isAllTerminal =
            nextChunks.length > 0 && nextChunks.every((c) => c.status === 'transcribed' || c.status === 'failed');
          // Only fire the auto-open when this event *flips* the recording
          // from "not done yet" to "all done". This way historical
          // recordings that were already complete when the page mounted
          // stay quiet — only the recording we *just* finished in this
          // session triggers the modal.
          if (!wasAllTerminal && isAllTerminal) shouldAutoOpen = true;
          return { ...rec, chunks: nextChunks };
        })
      );
      if (shouldAutoOpen) setAutoOpenId(id);
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
        Message.error(t('meeting-recording.errors.deleteFailed' as never));
      }
    },
    [recordings, t]
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('meeting-recording.title')}</h1>
      <RecorderPanel onRecorded={handleRecorded} />
      <RecordingList
        recordings={recordings}
        onDelete={handleDelete}
        loading={loading}
        autoOpenId={autoOpenId}
        onAutoOpenConsumed={() => setAutoOpenId(null)}
      />
    </div>
  );
};

export default MeetingRecordingPage;
