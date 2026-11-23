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
 * 响应：`{ hasOk, tip, message, bean, save }` —— 业务失败时 HTTP 仍是 200，
 * 靠 `hasOk: false` 表示（见 `SaveEnvelope`）。
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

/**
 * AIPaaS 的响应信封。
 *
 * 业务失败时 HTTP 仍然是 200，靠 `hasOk: false` 表示失败（接口文档里写的是
 * `success`，两边都认）。`message` 是给用户看的中文提示，`tip` 是给开发看的
 * 失败码（如 `FAIL`）—— 后者不展示给用户。
 */
type SaveEnvelope = {
  hasOk?: boolean;
  success?: boolean;
  message?: string | null;
  tip?: string | null;
};

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
         * 业务结果看响应信封 —— 平台失败时 HTTP 仍是 200，靠 `hasOk: false`
         * 表示「没建成」。响应体不含新库的 id，新库靠调用方刷新列表拿到。
         */
        const text = await response.text();
        if (text.trim() !== '') {
          let envelope: SaveEnvelope | null = null;
          try {
            envelope = JSON.parse(text) as SaveEnvelope;
          } catch (parseError) {
            // 不是 JSON —— 记一条日志，行为与从前一致（按成功处理）。
            console.warn('[useKnowledgeBaseCreate] unexpected response body:', text, parseError);
          }
          if (envelope && (envelope.hasOk === false || envelope.success === false)) {
            console.error('[useKnowledgeBaseCreate] create knowledge base failed:', envelope.tip ?? envelope.message);
            // `tip` 是给开发看的失败码（如 "FAIL"），展示给用户的是 message，
            // 没有 message 就给一句通用提示。
            const detail = (envelope.message ?? '').trim();
            setError(detail || t('settings.knowledgeBaseCreateFailed', { defaultValue: '新增失败' }));
            return false;
          }
        }

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
