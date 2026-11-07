/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@arco-design/web-react';
import { AppIcon } from '@aionui/ui';
import RecorderPanel from '../components/RecorderPanel';
import type { MeetingRecorder } from '../components/RecorderPanel';
import { useRecordingName } from '../hooks/useRecordingName';
import RecordingSettingsModal from './RecordingSettingsModal';
import styles from './RecordingEmptyState.module.css';

export type RecordingEmptyStateProps = {
  /** 页面持有的录音机 —— 弹窗与面板共用同一个实例。 */
  recorder: MeetingRecorder;
  /** 录音保存成功后回调 —— 页面据此刷新列表,空态随之退场。 */
  onRecorded?: () => void;
};

/**
 * 录音空态 —— 对齐设计稿 BadouWork-Desktop-Handoff 的 `.rec-empty-home`。
 *
 * 设计稿的几何:
 *   .rec-empty-home        居中一列,底部留 120px,行间距 20px
 *   .rec-empty-home h2     20px / 28px 标题
 *   .rec-empty-home .rec-actions    两个按钮并排,间距 12px
 *   .rec-empty-home .rec-settings-link  灰字 + 蓝色链接,间距 16px
 *
 * 「录音设置」是可点的:打开录音设置弹窗,确认后直接开始录音。
 * 「导入已有音频」没有对应的 IPC 能力,仍然置灰并用 Tooltip 说明。
 */
const RecordingEmptyState: React.FC<RecordingEmptyStateProps> = ({ recorder, onRecorded }) => {
  const { t } = useTranslation();
  const comingSoon = t('meeting-recording.featureComingSoon', { defaultValue: '功能开发中' });
  const [settingsVisible, setSettingsVisible] = useState(false);
  /**
   * 自动命名的生成器 —— 名字里带当前时间,只能在弹窗**打开的那一刻**才算,
   * 所以传函数给弹窗,而不是提前算好一个字符串。
   */
  const { buildDefaultName } = useRecordingName();

  /** 弹窗确认后关闭弹窗并开录 —— 用的是面板同一个录音机实例。 */
  const handleConfirm = async (name: string) => {
    setSettingsVisible(false);
    await recorder.start({ name });
  };

  return (
    <div className={styles.emptyHome} data-testid='recording-empty-state'>
      <div className={styles.illustration}>
        {/*
          设计稿的插画(`assets/cc33e.svg`)与侧栏麦克风(`nav-recording.svg`)
          是同一个图形 —— 后者是前者按 1/2 缩放后的版本,直接复用,不必再往
          `packages/ui` 的 svg 目录里加一份。
        */}
        <AppIcon name='nav-recording' size={44} />
      </div>

      <h2 className={styles.title}>{t('meeting-recording.emptyTitle', { defaultValue: '还没有录音' })}</h2>

      <p className={styles.description}>
        {t('meeting-recording.emptyDescription', { defaultValue: '点击开始，自动转写并整理纪要' })}
      </p>

      <div className={styles.actions}>
        <RecorderPanel recorder={recorder} onRecorded={onRecorded} />
        <Tooltip content={comingSoon}>
          <span className={styles.tooltipTarget}>
            <Button className={styles.secondaryButton} disabled>
              <AppIcon name='upload' size={16} />
              {t('meeting-recording.importAudio', { defaultValue: '导入已有音频' })}
            </Button>
          </span>
        </Tooltip>
      </div>

      <div className={styles.settingsRow}>
        <span className={styles.settingsHint}>
          {t('meeting-recording.defaultInputHint', { defaultValue: '默认麦克风 · 中文普通话' })}
        </span>
        <Button type='text' className={styles.settingsLink} onClick={() => setSettingsVisible(true)}>
          {t('meeting-recording.recordingSettings', { defaultValue: '录音设置' })}
        </Button>
      </div>

      <RecordingSettingsModal
        visible={settingsVisible}
        buildDefaultName={buildDefaultName}
        onCancel={() => setSettingsVisible(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default RecordingEmptyState;
