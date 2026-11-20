/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板（设计稿 `kb-queue` 视图）—— 悬浮在右下角，列出处理中的文件。
 *
 * 数据来源说明
 * ============
 * 后端**没有**「文件处理任务列表」接口 —— 设计稿里的队列是厂商后台的事件流
 * 驱动的。我们只能跟踪**本次会话**里上传的文件：上传成功后登记为「处理中」，
 * 等它出现在文档列表里就转成「已完成」。所以这个面板只反映当前会话，
 * 不是后端的真实队列。
 *
 * 正因为没有后端进度，「处理中」那条进度条是**不定态**的（一直走动），
 * 不编百分比；「已完成」才给条数。
 */

import DocumentFileIcon from './DocumentFileIcon';
import { AppIcon } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { interpolateI18n } from '../../utils/knowledgeBaseUtils';
import styles from './KnowledgeBaseQueuePanel.module.css';

/** 队列里的一项。 */
export type KnowledgeBaseQueueTask = {
  /** 本次会话内的唯一标识。 */
  id: string;
  /** 文件名。 */
  name: string;
  /** 处理中 / 已完成。 */
  status: 'processing' | 'done';
  /** 已完成时的数据条数。 */
  records?: number;
};

export type KnowledgeBaseQueuePanelProps = {
  visible: boolean;
  tasks: KnowledgeBaseQueueTask[];
  onClose: () => void;
  /** 清空已完成的任务。 */
  onClearDone: () => void;
};

const KnowledgeBaseQueuePanel: React.FC<KnowledgeBaseQueuePanelProps> = ({ visible, tasks, onClose, onClearDone }) => {
  const { t } = useTranslation();
  if (!visible) return null;

  const processingCount = tasks.filter((task) => task.status === 'processing').length;
  const doneCount = tasks.length - processingCount;

  return (
    <aside className={styles.panel} data-testid='kb-queue'>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{t('settings.knowledgeBaseQueueTitle', { defaultValue: '文件处理' })}</h2>
          <Button
            type='text'
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: '关闭' })}
            title={t('common.close', { defaultValue: '关闭' })}
            data-testid='kb-queue-close'
          >
            <AppIcon name='close-small' size={14} />
          </Button>
        </div>
        <p className={styles.summary} data-testid='kb-queue-summary'>
          {interpolateI18n(
            t('settings.knowledgeBaseQueueSummary', {
              processing: processingCount,
              done: doneCount,
              defaultValue: '处理中 {{processing}} 个文件 · 已完成 {{done}} 个',
            }),
            { processing: processingCount, done: doneCount }
          )}
        </p>
      </header>

      <div className={styles.files}>
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`${styles.file} ${task.status === 'done' ? styles.fileDone : ''}`}
            data-testid={`kb-queue-file-${task.id}`}
          >
            <div className={styles.fileName}>
              <DocumentFileIcon name={task.name} size={20} className={styles.fileIcon} />
              <span>{task.name}</span>
            </div>
            <div className={styles.state}>
              {task.status === 'processing' ? (
                <span>{t('settings.knowledgeBaseQueueProcessing', { defaultValue: '处理中' })}</span>
              ) : (
                <span>
                  {interpolateI18n(
                    t('settings.knowledgeBaseQueueDone', {
                      count: task.records ?? 0,
                      defaultValue: '已完成 · {{count}} 条数据',
                    }),
                    { count: task.records ?? 0 }
                  )}
                </span>
              )}
            </div>
            <div className={styles.progress}>
              {task.status === 'done' ? (
                <span className={styles.progressFill} />
              ) : (
                <span className={styles.progressRun} />
              )}
            </div>
          </div>
        ))}
      </div>

      <footer className={styles.footer}>
        <Button
          className={styles.clearButton}
          disabled={doneCount === 0}
          onClick={onClearDone}
          data-testid='kb-queue-clear-done'
        >
          {t('settings.knowledgeBaseQueueClearDone', { defaultValue: '清空已完成' })}
        </Button>
      </footer>
    </aside>
  );
};

export default KnowledgeBaseQueuePanel;
