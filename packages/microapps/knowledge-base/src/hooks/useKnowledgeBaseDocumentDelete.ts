/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 删除知识库里的文档（产品设计资料页的行内「更多 → 删除」）。
 *
 * 接口：`POST {AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasedelete/cancelUsingKnowledge.do`
 *   - `knowledgeId`    —— 要删的文档 id
 *   - `knowledgeBaseId` —— 该文档所属的知识库 id
 *
 * 接口名是「取消使用」而不是「删除」—— 语义上更接近「把这个文档从知识库
 * 里摘掉」，但效果就是删除：文档与它生成的知识内容数据一起没了。
 */

import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppRuntime } from '../AppContext';

const DELETE_URL = `${AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasedelete/cancelUsingKnowledge.do`;

export type UseKnowledgeBaseDocumentDeleteResult = {
  /** 删除文档。返回 true = 删除成功。 */
  remove: (knowledgeId: string) => Promise<boolean>;
  /** 删除中。 */
  deleting: boolean;
  /** 最近一次失败的原因（成功时为 null）。 */
  error: string | null;
};

/**
 * 删除知识库中的文档。
 *
 * @param options.knowledgeBaseId 文档所属的知识库 id。
 * @param options.onSuccess        删除成功时回调（调用方一般在这里关弹窗、刷列表）。
 */
export const useKnowledgeBaseDocumentDelete = (options: {
  knowledgeBaseId?: string;
  onSuccess?: () => void;
}): UseKnowledgeBaseDocumentDeleteResult => {
  const { token } = useAppRuntime();
  const { t } = useTranslation();
  const { knowledgeBaseId, onSuccess } = options;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(
    async (knowledgeId: string): Promise<boolean> => {
      setError(null);

      if (!token) {
        setError(t('common.failed', { defaultValue: 'Failed' }));
        return false;
      }
      if (!knowledgeBaseId || !knowledgeId) {
        setError(t('settings.knowledgeBaseDocumentDeleteFailed', { defaultValue: '删除失败，请稍后重试' }));
        return false;
      }

      setDeleting(true);
      try {
        const body = new URLSearchParams({
          knowledgeId,
          knowledgeBaseId,
        }).toString();

        const response = await fetch(DELETE_URL, {
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
         * 响应体不参与判断 —— 后端返回什么结构还没确认（可能只有一段空 body）。
         * 这里只关心「请求成功」。
         */
        await response.text();

        onSuccess?.();
        return true;
      } catch (err) {
        console.error('[useKnowledgeBaseDocumentDelete] failed to delete document:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [knowledgeBaseId, onSuccess, t, token]
  );

  return { remove, deleting, error };
};
