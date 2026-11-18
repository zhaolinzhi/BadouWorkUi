/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建知识库的保存逻辑。
 *
 * 接口：`POST {AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasesavev2/saveIncludeFile.do?mdCode=ai_knowledge_user`
 *   - `parentName` / `parentId` / `isCreateByDefaultConfig` —— 固定值
 *   - `name`    —— 知识库名称
 *   - `remarks` —— 知识库描述
 *
 * 共享知识库的保存接口与共享对象列表接口后端尚未提供 —— 接口到位前，
 * 选择「共享知识库」会明确报错（而不是静默失败）。
 */

import type { KnowledgeBaseCreateValues } from '../types';
import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppRuntime } from '../AppContext';

/**
 * 各可见范围对应的保存接口。
 *
 * 共享知识库那条是 `null` —— 后端还没给 mdCode 与「可见范围 / 共享对象」对应的
 * 参数名。接口到位后在这里补上即可，弹窗与调用方都不用改。
 */
const SAVE_ENDPOINTS: Record<KnowledgeBaseCreateValues['scope'], { mdCode: string; path: string } | null> = {
  personal: {
    mdCode: 'ai_knowledge_user',
    path: '/project/aiknowledge/aiknowledgebasesavev2/saveIncludeFile.do',
  },
  // TODO(knowledge-base): 共享知识库的保存接口待后端提供
  shared: null,
};

/** 固定参数：新建的知识库挂在「知识库目录」下。 */
const DEFAULT_PARENT_NAME = '知识库目录';
const DEFAULT_PARENT_ID = 'ROOT';
const DEFAULT_IS_CREATE_BY_DEFAULT_CONFIG = 'true';

export type UseKnowledgeBaseCreateResult = {
  /** 提交表单。返回 true = 创建成功。 */
  submit: (values: KnowledgeBaseCreateValues) => Promise<boolean>;
  /** 提交中。 */
  submitting: boolean;
  /** 最近一次失败的原因（成功时为 null）。 */
  error: string | null;
};

/**
 * 新建知识库。
 *
 * @param options.onSuccess 创建成功时回调（调用方一般在这里关弹窗、刷列表）。
 */
export const useKnowledgeBaseCreate = (options?: { onSuccess?: () => void }): UseKnowledgeBaseCreateResult => {
  const { token } = useAppRuntime();
  const { t } = useTranslation();
  /*
   * 解构出 `onSuccess` 再进依赖 —— 直接把 `options` 放进依赖数组的话，
   * 调用方每次渲染传的对象字面量都是新引用，`submit` 会跟着每次重建。
   */
  const { onSuccess } = options ?? {};
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (values: KnowledgeBaseCreateValues): Promise<boolean> => {
      // 先清掉上一次的错误 —— 共享分支的早退也在它之后，错误不会串场。
      setError(null);

      const endpoint = SAVE_ENDPOINTS[values.scope];
      if (!endpoint) {
        setError(
          t('settings.knowledgeBaseCreateModalSharedUnsupported', { defaultValue: '共享知识库创建接口暂未接入' })
        );
        return false;
      }
      if (!token) {
        setError(t('common.failed', { defaultValue: 'Failed' }));
        return false;
      }

      setSubmitting(true);
      try {
        const body = new URLSearchParams({
          parentName: DEFAULT_PARENT_NAME,
          parentId: DEFAULT_PARENT_ID,
          name: values.name.trim(),
          remarks: values.description.trim(),
          isCreateByDefaultConfig: DEFAULT_IS_CREATE_BY_DEFAULT_CONFIG,
        }).toString();

        const response = await fetch(`${AIPAAS_BASE_URL}${endpoint.path}?mdCode=${endpoint.mdCode}`, {
          method: 'POST',
          headers: {
            Token: token,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          credentials: 'include',
          body,
        });

        if (response.status === 401) {
          emitAuthExpired('knowledge-base');
          return false;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        /*
         * 响应体不参与判断 —— 后端返回什么结构还没确认（可能不含新库的 id）。
         * 新库靠调用方刷新列表拿到，所以这里只关心「请求成功」。
         */
        await response.text();

        onSuccess?.();
        return true;
      } catch (err) {
        console.error('[useKnowledgeBaseCreate] failed to create knowledge base:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, t, token]
  );

  return { submit, submitting, error };
};
