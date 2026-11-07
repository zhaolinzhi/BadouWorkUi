/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from '@arco-design/web-react';
import { AppIcon } from '@aionui/ui';
import RecorderPanel from '../components/RecorderPanel';
import styles from './RecordingEmptyState.module.css';

export type RecordingEmptyStateProps = {
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
 * 「导入已有音频」与「录音设置」目前没有后端能力(IPC bridge 里没有导入与
 * 设置的接口),按约定**只做视觉对齐**:入口照设计稿的位置渲染,但置灰,
 * 并用 Tooltip 说明功能尚未上线。
 */
const RecordingEmptyState: React.FC<RecordingEmptyStateProps> = ({ onRecorded }) => {
  const { t } = useTranslation();
  const comingSoon = t('meeting-recording.featureComingSoon', { defaultValue: '功能开发中' });

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
        <RecorderPanel onRecorded={onRecorded} />
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
        <Tooltip content={comingSoon}>
          <span className={styles.tooltipTarget}>
            <Button type='text' className={styles.settingsLink} disabled>
              {t('meeting-recording.recordingSettings', { defaultValue: '录音设置' })}
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
};

export default RecordingEmptyState;
