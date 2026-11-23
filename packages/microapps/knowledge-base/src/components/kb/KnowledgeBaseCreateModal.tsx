/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建知识库弹窗（设计稿 `kb-create` 视图）—— 表单、校验、布局。
 *
 * 只管表单状态与校验；请求逻辑在 `useKnowledgeBaseCreate` 里，由页面注入
 * （`onSubmit` / `submitting` / `error` 三个 props）。
 */

import type { KnowledgeBaseCreateValues } from '../../types';
import { Button, Input, Modal, Radio, Select } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseCreateModal.module.css';

export type KnowledgeBaseCreateModalProps = {
  visible: boolean;
  onCancel: () => void;
  /** 提交表单。返回 true 表示创建成功（父组件据此关弹窗）。 */
  onSubmit: (values: KnowledgeBaseCreateValues) => Promise<boolean>;
  submitting?: boolean;
  /** 最近一次失败的原因 —— 展示在弹窗内容区顶部。 */
  error?: string | null;
  /**
   * 共享对象选项。
   *
   * 共享对象列表接口后端还没提供 —— 现在传空数组即可，接口到位后把选项喂进来。
   */
  sharedTargets?: Array<{ label: string; value: string }>;
};

const KnowledgeBaseCreateModal: React.FC<KnowledgeBaseCreateModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  submitting = false,
  error = null,
  sharedTargets = [],
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<KnowledgeBaseCreateValues['scope']>('personal');
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  // 每次打开都从干净状态开始 —— 上一次填了一半的内容不该带过来。
  useEffect(() => {
    if (!visible) return;
    setName('');
    setDescription('');
    setScope('personal');
    setTarget(undefined);
    setNameError(null);
    setTargetError(null);
  }, [visible]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t('settings.knowledgeBaseNameRequired', { defaultValue: '知识库名称不能为空' }));
      return;
    }
    setNameError(null);

    if (scope === 'shared' && !target) {
      setTargetError(t('settings.knowledgeBaseCreateModalTargetPlaceholder', { defaultValue: '请选择共享对象' }));
      return;
    }
    setTargetError(null);

    await onSubmit({ name: trimmedName, description: description.trim(), scope, target });
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
          <h2 className={styles.title}>{t('settings.knowledgeBaseCreate', { defaultValue: '新建知识库' })}</h2>
          <p className={styles.subtitle}>
            {t('settings.knowledgeBaseCreateModalSubtitle', {
              defaultValue: '为文档建立一个专属空间，方便整理与使用。',
            })}
          </p>
        </div>
      }
    >
      <div className={styles.body}>
        {error ? (
          <div className={styles.error} data-testid='kb-create-error'>
            {error}
          </div>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor='kb-create-name'>
            {t('settings.knowledgeBaseCreateModalNameLabel', { defaultValue: '知识库名称' })}
            <span className={styles.required}>*</span>
          </label>
          <div className={styles.inputBox}>
            <Input
              id='kb-create-name'
              value={name}
              onChange={setName}
              maxLength={100}
              placeholder={t('settings.knowledgeBaseCreateModalNamePlaceholder', {
                defaultValue: '例如：产品资料、项目文档',
              })}
              data-testid='kb-create-name'
            />
            <span className={styles.counter}>{name.length}/100</span>
          </div>
          {nameError ? (
            <span className={styles.fieldError} data-testid='kb-create-name-error'>
              {nameError}
            </span>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor='kb-create-description'>
            {t('settings.knowledgeBaseCreateModalDescriptionLabel', { defaultValue: '描述' })}
            <small className={styles.optional}>
              {t('settings.knowledgeBaseCreateDescriptionOptional', { defaultValue: '（选填）' })}
            </small>
          </label>
          <div className={styles.textareaBox}>
            <Input.TextArea
              id='kb-create-description'
              value={description}
              onChange={setDescription}
              maxLength={255}
              placeholder={t('settings.knowledgeBaseCreateModalDescriptionPlaceholder', {
                defaultValue: '简单介绍这个知识库的用途',
              })}
              data-testid='kb-create-description'
            />
            <span className={styles.counter}>{description.length}/255</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>
            {t('settings.knowledgeBaseCreateModalScopeLabel', { defaultValue: '可见范围' })}
          </span>
          <Radio.Group
            type='radio'
            value={scope}
            onChange={(value) => setScope(value as KnowledgeBaseCreateValues['scope'])}
            className={styles.scopeGroup}
          >
            <Radio value='personal' data-testid='kb-create-scope-personal'>
              <span className={styles.scopeCopy}>
                <span>{t('settings.knowledgeBaseTabPersonal', { defaultValue: '个人知识库' })}</span>
                <small>{t('settings.knowledgeBasePrivateOnly', { defaultValue: '仅自己可见' })}</small>
              </span>
            </Radio>
            <Radio value='shared' disabled data-testid='kb-create-scope-shared'>
              <span className={styles.scopeCopy}>
                <span>{t('settings.knowledgeBaseTabShared', { defaultValue: '共享知识库' })}</span>
                <small>{t('settings.knowledgeBaseCreateModalScopeSharedHint', { defaultValue: '所选对象可见' })}</small>
              </span>
            </Radio>
          </Radio.Group>
        </div>

        {scope === 'shared' ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor='kb-create-target'>
              {t('settings.knowledgeBaseCreateModalTargetLabel', { defaultValue: '共享对象' })}
              <span className={styles.required}>*</span>
            </label>
            <Select
              id='kb-create-target'
              value={target}
              onChange={setTarget}
              options={sharedTargets}
              placeholder={t('settings.knowledgeBaseCreateModalTargetPlaceholder', { defaultValue: '请选择共享对象' })}
              className={styles.select}
              data-testid='kb-create-target'
            />
            {sharedTargets.length === 0 ? (
              <span className={styles.hint} data-testid='kb-create-target-empty'>
                {t('settings.knowledgeBaseCreateModalTargetEmpty', { defaultValue: '暂无可选共享对象' })}
              </span>
            ) : null}
            {targetError ? (
              <span className={styles.fieldError} data-testid='kb-create-target-error'>
                {targetError}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.footer}>
        <Button className={styles.cancelButton} onClick={onCancel} data-testid='kb-create-cancel'>
          {t('common.cancel', { defaultValue: '取消' })}
        </Button>
        <Button
          type='primary'
          className={styles.submitButton}
          loading={submitting}
          onClick={() => void handleSubmit()}
          data-testid='kb-create-submit'
        >
          {t('settings.knowledgeBaseCreateModalSubmit', { defaultValue: '创建知识库' })}
        </Button>
      </div>
    </Modal>
  );
};

export default KnowledgeBaseCreateModal;
