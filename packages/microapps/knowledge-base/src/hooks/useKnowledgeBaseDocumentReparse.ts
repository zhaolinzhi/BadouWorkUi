/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 重新解析知识库里的文档（产品设计资料页的行内「更多 → 重新解析」）。
 *
 * 接口：`POST {AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasesavev2/reParseKnowledges`
 *   - `knowledgeIds`   —— 要重新解析的文档 id（多个用逗号分隔）
 *   - `knowledgeBaseId` —— 该文档所属的知识库 id
 *
 * 重新解析是**异步处理**的：接口返回时文件还在处理中，「N 条数据」要等解析
 * 完才会变 —— 所以调用方要在成功后轮询几次列表。
 */

import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppRuntime } from '../AppContext';

const REPARSE_URL = `${AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasesavev2/reParseKnowledges`;

export type UseKnowledgeBaseDocumentReparseResult = {
  /** 重新解析。传入要解析的文档 id 列表。返回 true = 请求成功。 */
  reparse: (knowledgeIds: string[]) => Promise<boolean>;
  /** 请求中。 */
  reparsing: boolean;
  /** 最近一次失败的原因（成功时为 null）。 */
  error: string | null;
};

/**
 * 重新解析知识库中的文档。
 *
 * @param options.knowledgeBaseId 文档所属的知识库 id。
 * @param options.onSuccess        请求成功时回调（调用方一般在这里关弹窗、刷列表）。
 */
export const useKnowledgeBaseDocumentReparse = (options: {
  knowledgeBaseId?: string;
  onSuccess?: () => void;
}): UseKnowledgeBaseDocumentReparseResult => {
  const { token } = useAppRuntime();
  const { t } = useTranslation();
  const { knowledgeBaseId, onSuccess } = options;

  const [reparsing, setReparsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reparse = useCallback(
    async (knowledgeIds: string[]): Promise<boolean> => {
      setError(null);

      const ids = knowledgeIds.filter((id) => Boolean(id));
      if (!token) {
        setError(t('common.failed', { defaultValue: 'Failed' }));
        return false;
      }
      if (!knowledgeBaseId || ids.length === 0) {
        setError(t('settings.knowledgeBaseDocumentReparseFailed', { defaultValue: '重新解析失败，请稍后重试' }));
        return false;
      }

      setReparsing(true);
      try {
        const body = new URLSearchParams({
          // 接口的参数名是复数 —— 多个文档用逗号分隔。
          knowledgeIds: ids.join(','),
          knowledgeBaseId,
        }).toString();

        const response = await fetch(REPARSE_URL, {
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
        console.error('[useKnowledgeBaseDocumentReparse] failed to reparse documents:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        return false;
      } finally {
        setReparsing(false);
      }
    },
    [knowledgeBaseId, onSuccess, t, token]
  );

  return { reparse, reparsing, error };
};
