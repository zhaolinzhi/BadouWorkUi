/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板（设计稿 `kb-queue` 视图）—— 悬浮在右下角，列出处理中的文件。
 *
 * 数据来源
 * ========
 * 队列用**文档列表接口**（`view_knowledge_relevancy`）返回的 `progress`
 * 字段 —— 后端解析进度时会更新它，100 即处理完成。请求由
 * `useKnowledgeBaseQueue` 发出：参数固定（knowledgeBaseId 过滤 + 第 1 页、
 * 每页 30 条），不跟页面上的搜索词 / 排序走。
 *
 * 「暂停 / 继续」没做：后端没有对应的任务控制接口，做了就是假按钮。
 */

import type { KnowledgeBaseDocument } from '../../types';
import DocumentFileIcon from './DocumentFileIcon';
import { AppIcon, AsyncBoundary } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { interpolateI18n } from '../../utils/knowledgeBaseUtils';
import styles from './KnowledgeBaseQueuePanel.module.css';

export type KnowledgeBaseQueuePanelProps = {
  visible: boolean;
  /** 知识库里的文件列表（带 progress）。 */
  documents: KnowledgeBaseDocument[];
  /** 首次加载中（还没有任何内容）。 */
  loading?: boolean;
  /** 加载失败 —— 只在列表为空时显示错误态。 */
  error?: string | null;
  /** 错误态的「重试」。 */
  onRetry?: () => void;
  /** 只看处理中的（清空已完成之后）。 */
  onlyProcessing?: boolean;
  onClose: () => void;
  /** 清空已完成 —— 只隐藏已完成的条目，不动服务端数据。 */
  onClearDone: () => void;
};

/**
 * 文件是否已处理完（已解析）。
 *
 * 状态来自接口的 `flgSplit`（已解析 / 解析失败 / 处理中）；百分比来自
 * `progress` —— 该字段还没上线，处理中的文件暂时按 0% 显示。
 */
const isDone = (doc: KnowledgeBaseDocument): boolean => doc.splitStatus === 'done';

const KnowledgeBaseQueuePanel: React.FC<KnowledgeBaseQueuePanelProps> = ({
  visible,
  documents,
  loading = false,
  error = null,
  onRetry,
  onlyProcessing = false,
  onClose,
  onClearDone,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  const processingCount = documents.filter((doc) => doc.splitStatus === 'processing').length;
  const doneCount = documents.filter((doc) => doc.splitStatus === 'done').length;
  const failedCount = documents.filter((doc) => doc.splitStatus === 'failed').length;
  // 「清空已完成」只藏已解析的 —— 解析失败的文件还要留在列表里让人看到。
  const visibleItems = onlyProcessing ? documents.filter((doc) => !isDone(doc)) : documents;

  /**
   * 列表区内容 —— 加载中 / 出错 / 空 / 列表。
   *
   * 四态用共享的 `AsyncBoundary` 渲染：出错时的虚线框、标题 / 详情两级文字、
   * 主色重试按钮都与其它页面一致，不在这里另写一套。
   */
  const renderBody = () => (
    <AsyncBoundary
      loading={loading && documents.length === 0}
      error={error && documents.length === 0 ? error : null}
      isEmpty={visibleItems.length === 0}
      onRetry={onRetry}
      retryText={t('common.retry', { defaultValue: '重试' })}
      errorContent={
        <span data-testid='kb-queue-error'>
          {t('settings.knowledgeBaseDetailLoadFailed', { defaultValue: '加载文档失败' })}
        </span>
      }
      loadingContent={<span data-testid='kb-queue-loading'>{t('common.loading', { defaultValue: '请稍候...' })}</span>}
      emptyContent={
        <span className={styles.placeholderText} data-testid='kb-queue-empty'>
          {t('settings.knowledgeBaseQueueEmpty', { defaultValue: '暂无文件处理任务' })}
        </span>
      }
      className={styles.boundary}
    >
      {visibleItems.map((doc) => {
        const done = doc.splitStatus === 'done';
        const failed = doc.splitStatus === 'failed';
        // 百分比要等接口的 `progress` 字段 —— 现在处理中的文件按 0% 显示。
        const percent = done ? 100 : (doc.progress ?? 0);
        return (
          <div
            key={doc.id}
            className={`${styles.file} ${done ? styles.fileDone : ''} ${failed ? styles.fileFailed : ''}`}
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
              ) : failed ? (
                <span>{t('settings.knowledgeBaseQueueFailed', { defaultValue: '解析失败' })}</span>
              ) : (
                <span>{t('settings.knowledgeBaseQueueProcessing', { defaultValue: '处理中' })}</span>
              )}
              {failed ? null : <span className={styles.percent}>{Math.round(percent)}%</span>}
            </div>
            {/* 解析失败的文件不画进度条 —— 一条满格的红条会被当成「解析好了」。 */}
            {failed ? null : (
              <div className={styles.progress}>
                <span
                  className={done ? styles.progressFill : styles.progressBar}
                  style={done ? undefined : { width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </AsyncBoundary>
  );

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
          {failedCount > 0
            ? interpolateI18n(
                t('settings.knowledgeBaseQueueSummaryWithFailed', {
                  processing: processingCount,
                  done: doneCount,
                  failed: failedCount,
                  defaultValue: '处理中 {{processing}} 个文件 · 已完成 {{done}} 个 · 失败 {{failed}} 个',
                }),
                { processing: processingCount, done: doneCount, failed: failedCount }
              )
            : interpolateI18n(
                t('settings.knowledgeBaseQueueSummary', {
                  processing: processingCount,
                  done: doneCount,
                  defaultValue: '处理中 {{processing}} 个文件 · 已完成 {{done}} 个',
                }),
                { processing: processingCount, done: doneCount }
              )}
        </p>
      </header>

      <div className={styles.files}>{renderBody()}</div>

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
