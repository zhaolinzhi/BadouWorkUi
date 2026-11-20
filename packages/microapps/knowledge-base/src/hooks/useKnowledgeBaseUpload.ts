/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库文档上传（产品设计资料页「添加资料」）。
 *
 * 接口：`POST {AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasesavev2/uploadDocument.do`
 *   —— `multipart/form-data`，一次请求可带多个文件。
 *
 *   | 参数              | 值                       | 说明                       |
 *   | ----------------- | ------------------------ | -------------------------- |
 *   | `fileType`        | `10`                     | 固定值                     |
 *   | `parseMethod`     | `1`                      | 固定值                     |
 *   | `visualModelCode` | 空                       | 视觉模型编码（暂不用）     |
 *   | `promptWord`      | 空                       | 提示词（暂不用）           |
 *   | `flgExtractImage` | `0`                      | 不抽取图片                 |
 *   | `flgContextParsing`| `0`                     | 不做上下文解析             |
 *   | `attach`          | 文件二进制，**可重复**   | 每个文件一个同名字段       |
 *   | `knowledgeBaseId` | 知识库 id                | 目标知识库                 |
 *   | `uploadType`      | `knowledgeBase`          | 上传场景                   |
 *
 * `attach` 用同一个字段名追加多次 —— 后端按重复字段收集，与浏览器「多选文件」
 * 的请求形态一致。
 */

import { AIPAAS_BASE_URL } from '../utils/api';
import { emitAuthExpired } from '@aionui/microapp-shared';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppRuntime } from '../AppContext';

const UPLOAD_URL = `${AIPAAS_BASE_URL}/project/aiknowledge/aiknowledgebasesavev2/uploadDocument.do`;

/** 接口的固定参数。 */
const FIXED_PARAMS: Array<[string, string]> = [
  ['fileType', '10'],
  ['parseMethod', '1'],
  ['visualModelCode', ''],
  ['promptWord', ''],
  ['flgExtractImage', '0'],
  ['flgContextParsing', '0'],
];

/** 文件字段名 —— 多个文件用同一个名字重复追加。 */
const FILE_FIELD = 'attach';

/** 上传场景。 */
const UPLOAD_TYPE = 'knowledgeBase';

/**
 * 允许上传的扩展名。
 *
 * 设计稿只写了 PDF / DOCX / TXT，但知识库里的文档明显不止这三类（列表里就有
 * Markdown），所以这里放宽到常见的文档类型；真正能不能解析由后端决定。
 */
export const ACCEPTED_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.json',
];

/** 待上传文件。 */
export type KnowledgeBaseUploadFile = {
  /** 列表里的唯一标识。 */
  uid: string;
  /** 文件名。 */
  name: string;
  /** 原始 File 对象（真正发给后端的就是它）。 */
  file: File;
};

export type UseKnowledgeBaseUploadResult = {
  /** 待上传文件列表。 */
  files: KnowledgeBaseUploadFile[];
  /** 加入文件（同名同大小视为同一个，重复选择不会重复加入）。 */
  addFiles: (incoming: File[]) => void;
  /** 移除某个待上传文件。 */
  removeFile: (uid: string) => void;
  /** 清空列表与错误。 */
  reset: () => void;
  /** 提交待传列表。返回 true = 上传成功。 */
  submit: () => Promise<boolean>;
  /** 直接上传给定的一批文件（「新建文本」用 —— 没有待传列表）。 */
  uploadFiles: (items: KnowledgeBaseUploadFile[]) => Promise<boolean>;
  /** 上传中。 */
  uploading: boolean;
  /** 最近一次失败的原因（成功时为 null）。 */
  error: string | null;
};

/** 从文件名里取扩展名（大写，无点）。 */
const extensionOf = (name: string): string => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';

/** 同一个文件（同名 + 同大小）不重复加入。 */
const isDuplicate = (list: KnowledgeBaseUploadFile[], file: File): boolean =>
  list.some((item) => item.name === file.name && item.file.size === file.size);

/**
 * 响应体是否明确表示失败。
 *
 * 后端的响应结构还没确认（可能只有一段空 body），所以只在**明确**失败时才
 * 判失败 —— `success: false` 或 `code >= 400`。其余情况按成功处理。
 */
const isRejected = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  if (record.success === false) return true;
  const code = record.code;
  return typeof code === 'number' && code >= 400;
};

/**
 * 上传文档到知识库。
 *
 * @param options.knowledgeBaseId 目标知识库 id。
 * @param options.onSuccess        上传成功时回调（调用方一般在这里关弹窗、刷列表）。
 */
export const useKnowledgeBaseUpload = (options: {
  knowledgeBaseId?: string;
  onSuccess?: () => void;
}): UseKnowledgeBaseUploadResult => {
  const { token } = useAppRuntime();
  const { t } = useTranslation();
  const { knowledgeBaseId, onSuccess } = options;

  const [files, setFiles] = useState<KnowledgeBaseUploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (isDuplicate(next, file)) continue;
        next.push({
          uid: `${next.length}-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          file,
        });
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((uid: string) => {
    setFiles((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  /**
   * 上传给定的一批文件。
   *
   * 「新建文本」走这里 —— 它没有待传列表，文本是现造的一个 File。
   */
  const uploadFiles = useCallback(
    async (items: KnowledgeBaseUploadFile[]): Promise<boolean> => {
      setError(null);

      if (!token) {
        setError(t('common.failed', { defaultValue: 'Failed' }));
        return false;
      }
      if (!knowledgeBaseId) {
        setError(t('settings.knowledgeBaseUploadFailed', { defaultValue: '上传失败，请稍后重试' }));
        return false;
      }
      if (items.length === 0) {
        setError(t('settings.knowledgeBaseUploadNoFiles', { defaultValue: '请先选择要上传的文件' }));
        return false;
      }

      setUploading(true);
      try {
        const body = new FormData();
        for (const [key, value] of FIXED_PARAMS) {
          body.append(key, value);
        }
        // 多个文件用同一个字段名重复追加 —— 后端按重复字段收集。
        for (const item of items) {
          body.append(FILE_FIELD, item.file, item.name);
        }
        body.append('knowledgeBaseId', knowledgeBaseId);
        body.append('uploadType', UPLOAD_TYPE);

        const response = await fetch(UPLOAD_URL, {
          method: 'POST',
          headers: {
            Token: token,
            // 不设 Content-Type —— 浏览器的 boundary 是自动生成的，手写会破坏分片。
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

        const text = await response.text();
        if (text.trim() !== '') {
          // 响应体不是 JSON 也不当作失败 —— 结构还没确认，按成功处理。
          let payload: unknown = null;
          try {
            payload = JSON.parse(text);
          } catch {
            payload = null;
          }
          if (isRejected(payload)) {
            throw new Error('upload rejected by server');
          }
        }

        onSuccess?.();
        return true;
      } catch (err) {
        console.error('[useKnowledgeBaseUpload] failed to upload documents:', err);
        setError(err instanceof Error ? err.message : 'unknown error');
        return false;
      } finally {
        setUploading(false);
      }
    },
    [knowledgeBaseId, onSuccess, t, token]
  );

  /** 提交待传列表。 */
  const submit = useCallback(async (): Promise<boolean> => uploadFiles(files), [files, uploadFiles]);

  return { files, addFiles, removeFile, reset, submit, uploadFiles, uploading, error };
};

export { extensionOf };
