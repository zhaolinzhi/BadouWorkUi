/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建文本弹窗（设计稿 `kb-text` 视图）—— 名称 + 正文，存成知识库里的一个文本文件。
 *
 * 只管表单状态与校验；请求逻辑在 `useKnowledgeBaseUpload` 里，由页面注入
 * （`onSubmit` / `submitting` / `error` 三个 props）。
 */

import { Button, Input, Modal } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseTextModal.module.css';

/** 「新建文本」的表单值。 */
export type KnowledgeBaseTextValues = {
  /** 文件名（不含扩展名，扩展名由调用方补）。 */
  name: string;
  /** 正文内容。 */
  text: string;
};

export type KnowledgeBaseTextModalProps = {
  visible: boolean;
  onCancel: () => void;
  /** 提交表单。返回 true 表示成功（父组件据此关弹窗）。 */
  onSubmit: (values: KnowledgeBaseTextValues) => Promise<boolean>;
  submitting?: boolean;
  /** 最近一次失败的原因 —— 展示在弹窗内容区顶部。 */
  error?: string | null;
};

const MAX_NAME_LENGTH = 100;

const KnowledgeBaseTextModal: React.FC<KnowledgeBaseTextModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  submitting = false,
  error = null,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  // 每次打开都从干净状态开始 —— 上一次填了一半的内容不该带过来。
  useEffect(() => {
    if (!visible) return;
    setName('');
    setText('');
    setNameError(null);
    setTextError(null);
  }, [visible]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedText = text.trim();

    if (!trimmedName) {
      setNameError(t('settings.knowledgeBaseTextNameRequired', { defaultValue: '请输入文本名称' }));
      return;
    }
    setNameError(null);

    if (!trimmedText) {
      setTextError(t('settings.knowledgeBaseTextBodyRequired', { defaultValue: '请输入正文内容' }));
      return;
    }
    setTextError(null);

    await onSubmit({ name: trimmedName, text: trimmedText });
  };

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      unmountOnExit
      className={styles.modal}
      title={
        <div className={styles.header}>
          <h2 className={styles.title}>{t('settings.knowledgeBaseTextTitle', { defaultValue: '新建文本' })}</h2>
          <p className={styles.subtitle}>
            {t('settings.knowledgeBaseTextSubtitle', {
              defaultValue: '直接记录内容，作为知识库中的一个文件。',
            })}
          </p>
        </div>
      }
    >
      <div className={styles.body}>
        {error ? (
          <div className={styles.error} data-testid='kb-text-error'>
            {error}
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor='kb-text-name'>
            {t('settings.knowledgeBaseTextNameLabel', { defaultValue: '名称' })}
            <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputBox}>
            <Input
              id='kb-text-name'
              value={name}
              onChange={setName}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t('settings.knowledgeBaseTextNamePlaceholder', { defaultValue: '输入文件名称' })}
              data-testid='kb-text-name'
            />
            <span className={styles.counter}>
              {name.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
          {nameError ? (
            <span className={styles.fieldError} data-testid='kb-text-name-error'>
              {nameError}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor='kb-text-body'>
            {t('settings.knowledgeBaseTextBodyLabel', { defaultValue: '正文' })}
            <span className={styles.required}>*</span>
          </label>
          <div className={styles.textareaBox}>
            <Input.TextArea
              id='kb-text-body'
              value={text}
              onChange={setText}
              placeholder={t('settings.knowledgeBaseTextBodyPlaceholder', { defaultValue: '输入文本内容' })}
              data-testid='kb-text-body'
            />
          </div>
          {textError ? (
            <span className={styles.fieldError} data-testid='kb-text-body-error'>
              {textError}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.footer}>
        <Button className={styles.cancelButton} onClick={onCancel} data-testid='kb-text-cancel'>
          {t('common.cancel', { defaultValue: '取消' })}
        </Button>
        <Button
          type='primary'
          className={styles.submitButton}
          loading={submitting}
          onClick={() => void handleSubmit()}
          data-testid='kb-text-submit'
        >
          {t('settings.knowledgeBaseTextSubmit', { defaultValue: '添加并处理' })}
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgeBaseTextModal;
