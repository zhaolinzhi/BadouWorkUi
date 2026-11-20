/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板（设计稿 `kb-queue` 视图）—— 悬浮在右下角，列出处理中的文件。
 *
 * 数据来源
 * ========
 * 队列直接用**文档列表接口**（`view_knowledge_relevancy`）返回的 `progress`
 * 字段 —— 后端解析进度时会更新它，100 即处理完成。
 *
 * 「暂停 / 继续」没做：后端没有对应的任务控制接口，做了就是假按钮。
 */

import type { KnowledgeBaseDocument } from '../../types';
import DocumentFileIcon from './DocumentFileIcon';
import { AppIcon } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { interpolateI18n } from '../../utils/knowledgeBaseUtils';
import styles from './KnowledgeBaseQueuePanel.module.css';

export type KnowledgeBaseQueuePanelProps = {
  visible: boolean;
  /** 知识库里的文件列表（带 progress）。 */
  documents: KnowledgeBaseDocument[];
  /** 只看处理中的（清空已完成之后）。 */
  onlyProcessing?: boolean;
  onClose: () => void;
  /** 清空已完成 —— 只隐藏已完成的条目，不动服务端数据。 */
  onClearDone: () => void;
};

/**
 * 文件是否已处理完。
 *
 * `progress` 缺失时按「已完成」处理 —— 接口不给进度说明它已经解析完了。
 */
const isDone = (doc: KnowledgeBaseDocument): boolean => doc.progress === undefined || doc.progress >= 100;

const KnowledgeBaseQueuePanel: React.FC<KnowledgeBaseQueuePanelProps> = ({
  visible,
  documents,
  onlyProcessing = false,
  onClose,
  onClearDone,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  const processingCount = documents.filter((doc) => !isDone(doc)).length;
  const doneCount = documents.length - processingCount;
  const visibleItems = onlyProcessing ? documents.filter((doc) => !isDone(doc)) : documents;

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
        {visibleItems.map((doc) => {
          const done = isDone(doc);
          const percent = doc.progress ?? 100;
          return (
            <div
              key={doc.id}
              className={`${styles.file} ${done ? styles.fileDone : ''}`}
              data-testid={`kb-queue-file-${doc.id}`}
            >
              <div className={styles.fileName}>
                <DocumentFileIcon name={doc.name} type={doc.type} size={20} className={styles.fileIcon} />
                <span>{doc.name}</span>
              </div>
              <div className={styles.state}>
                {done ? (
                  <span>
                    {interpolateI18n(
                      t('settings.knowledgeBaseQueueDone', {
                        count: doc.records,
                        defaultValue: '已完成 · {{count}} 条数据',
                      }),
                      { count: doc.records }
                    )}
                  </span>
                ) : (
                  <span>{t('settings.knowledgeBaseQueueProcessing', { defaultValue: '处理中' })}</span>
                )}
                <span className={styles.percent}>{Math.round(percent)}%</span>
              </div>
              <div className={styles.progress}>
                <span
                  className={done ? styles.progressFill : styles.progressBar}
                  style={done ? undefined : { width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
            </div>
          );
        })}
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
