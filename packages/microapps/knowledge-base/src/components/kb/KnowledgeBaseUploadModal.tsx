/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 上传文件弹窗（设计稿 `kb-upload` 视图）—— 拖拽/选择文件、待上传清单、导入。
 *
 * 只管界面与本地文件状态；真正的请求在 `useKnowledgeBaseUpload` 里，由页面注入
 * （`onSubmit` / `uploading` / `error` 三个 props）。
 */

import type { KnowledgeBaseUploadFile } from '../../hooks/useKnowledgeBaseUpload';
import DocumentFileIcon from './DocumentFileIcon';
import { ACCEPTED_UPLOAD_EXTENSIONS } from '../../hooks/useKnowledgeBaseUpload';
import { interpolateI18n } from '../../utils/knowledgeBaseUtils';
import { AppIcon } from '@aionui/ui';
import { Button, Modal, Upload } from '@arco-design/web-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseUploadModal.module.css';

export type KnowledgeBaseUploadModalProps = {
  visible: boolean;
  onCancel: () => void;
  /** 目标知识库名 —— 副标题里要用。 */
  knowledgeBaseName?: string;
  /** 待上传文件。 */
  files?: KnowledgeBaseUploadFile[];
  /** 加入文件。 */
  onAddFiles?: (incoming: File[]) => void;
  /** 移除某个待上传文件。 */
  onRemoveFile?: (uid: string) => void;
  /** 提交上传。返回 true 表示成功（父组件据此关弹窗）。 */
  onSubmit: () => Promise<boolean>;
  uploading?: boolean;
  /** 最近一次失败的原因 —— 展示在弹窗内容区顶部。 */
  error?: string | null;
};

/** 文件名 → 扩展名（大写，无点）；取不到时给 `FILE`。 */
const formatOf = (name: string): string =>
  name
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1]
    ?.toUpperCase() ?? 'FILE';

const KnowledgeBaseUploadModal: React.FC<KnowledgeBaseUploadModalProps> = ({
  visible,
  onCancel,
  knowledgeBaseName = '',
  files = [],
  onAddFiles = () => undefined,
  onRemoveFile = () => undefined,
  onSubmit,
  uploading = false,
  error = null,
}) => {
  const { t } = useTranslation();

  /*
   * Arco 的 Upload 需要一份 `UploadItem` 列表 —— 它用自己的 uid / status，
   * 这里把我们的文件映射过去，`onChange` 再把原始 File 取回来。
   */
  const arcoFileList = useMemo(
    () =>
      files.map((item) => ({
        uid: item.uid,
        name: item.name,
        status: 'init' as const,
        percent: 0,
        originFile: item.file,
      })),
    [files]
  );

  const handleArcoChange = (list: Array<{ originFile?: File }>) => {
    onAddFiles(list.map((item) => item.originFile).filter((file): file is File => Boolean(file)));
  };

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      unmountOnExit
      className={styles.modal}
      title={
        <div className={styles.header}>
          <h2 className={styles.title}>{t('settings.knowledgeBaseUploadTitle', { defaultValue: '上传文件' })}</h2>
          <p className={styles.subtitle}>
            {interpolateI18n(
              t('settings.knowledgeBaseUploadSubtitle', {
                name: knowledgeBaseName,
                defaultValue: '添加到{{name}}，整理你的知识素材',
              }),
              { name: knowledgeBaseName }
            )}
          </p>
        </div>
      }
      footer={
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            {t('settings.knowledgeBaseUploadFooterHint', { defaultValue: '处理后可用于检索与问答' })}
          </span>
          <Button className={styles.cancelButton} onClick={onCancel} data-testid='kb-upload-cancel'>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            type='primary'
            className={styles.submitButton}
            loading={uploading}
            disabled={files.length === 0}
            onClick={() => void onSubmit()}
            data-testid='kb-upload-submit'
          >
            {t('settings.knowledgeBaseUploadSubmit', { defaultValue: '导入并处理' })}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {error ? (
          <div className={styles.error} data-testid='kb-upload-error'>
            {error}
          </div>
        ) : null}

        {/*
         * 拖拽区用 Arco 的 `Upload` —— 它自带隐藏的 file input 与拖拽事件，
         * 免得在微应用里手写原生 `<input type="file">`。
         * `autoUpload={false}`：文件不交给 Arco 传，而是我们自己拼 FormData 发。
         */}
        <Upload
          className={styles.upload}
          drag
          multiple
          autoUpload={false}
          showUploadList={false}
          accept={ACCEPTED_UPLOAD_EXTENSIONS.join(',')}
          fileList={arcoFileList}
          onChange={handleArcoChange}
        >
          <div className={styles.dropZone} data-testid='kb-upload-dropzone'>
            <span className={styles.dropSymbol}>
              <AppIcon name='upload' size={22} />
            </span>
            <p className={styles.dropText}>
              {t('settings.knowledgeBaseUploadDropText', { defaultValue: '拖拽文件至此处，或' })}
              <strong className={styles.dropLink}>
                {t('settings.knowledgeBaseUploadChooseFile', { defaultValue: '选择文件' })}
              </strong>
            </p>
            <small className={styles.dropHint}>
              {t('settings.knowledgeBaseUploadFileTypes', { defaultValue: '支持 PDF、DOCX、TXT 等文件' })}
            </small>
          </div>
        </Upload>

        {files.length > 0 ? (
          <div className={styles.pending} data-testid='kb-upload-pending'>
            <div className={styles.pendingLabel}>
              {interpolateI18n(
                t('settings.knowledgeBaseUploadPendingLabel', {
                  count: files.length,
                  defaultValue: '待上传文件 {{count}}',
                }),
                { count: files.length }
              )}
            </div>
            {files.map((item, index) => (
              <div key={item.uid} className={styles.pendingFile} data-testid={`kb-upload-file-${index}`}>
                <DocumentFileIcon name={item.name} size={28} className={styles.pendingIcon} />
                <div className={styles.pendingInfo}>
                  <p className={styles.pendingName}>{item.name}</p>
                  <span className={styles.pendingMeta}>
                    {formatOf(item.name)} · {t('settings.knowledgeBaseUploadReady', { defaultValue: '准备导入' })}
                  </span>
                </div>
                <Button
                  type='text'
                  className={styles.removeButton}
                  onClick={() => onRemoveFile(item.uid)}
                  aria-label={interpolateI18n(
                    t('settings.knowledgeBaseUploadRemoveFile', {
                      name: item.name,
                      defaultValue: '移除 {{name}}',
                    }),
                    { name: item.name }
                  )}
                  title={interpolateI18n(
                    t('settings.knowledgeBaseUploadRemoveFile', {
                      name: item.name,
                      defaultValue: '移除 {{name}}',
                    }),
                    { name: item.name }
                  )}
                  data-testid={`kb-upload-remove-${index}`}
                >
                  <AppIcon name='delete' size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KnowledgeBaseUploadModal;
