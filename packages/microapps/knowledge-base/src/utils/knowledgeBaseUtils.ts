/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseDocument, KnowledgeBaseSplitStatus } from '../types';
import { isBackendRelativeAssetPath, isLikelyLocalFilePath } from './assistantAvatar';
import { AIPAAS_BASE_URL } from './api';
import { resolveExtensionAssetUrl } from './platform';

/**
 * Check if a string is an emoji (simple check for common emoji patterns).
 */
export const isEmoji = (str: string): boolean => {
  if (!str) return false;
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}️)(?:‍(?:\p{Emoji_Presentation}|\p{Emoji}️))*$/u;
  return emojiRegex.test(str);
};

/**
 * Resolve an icon string to an image src URL, or undefined if it is not an image.
 */
export const resolveIconImageSrc = (icon: string | undefined): string | undefined => {
  const value = icon?.trim();
  if (!value) return undefined;

  if (isLikelyLocalFilePath(value)) return undefined;
  if (value.startsWith('/') && !isBackendRelativeAssetPath(value)) return undefined;

  const resolved = resolveExtensionAssetUrl(value) || value;
  const isImage = /\.(svg|png|jpe?g|webp|gif)$/i.test(resolved) || /^(https?:|file:\/\/|data:|\/)/i.test(resolved);
  return isImage ? resolved : undefined;
};

/**
 * i18n 插值兜底。
 *
 * `react-i18next` 只有在接管了 shell 的 i18next 实例时才会做插值;standalone
 * 运行(或 shell 还没执行 expose-i18n)时,`t(key, { defaultValue })` 只会原样
 * 返回 defaultValue,`{{count}}` 这类占位符会裸露在界面上。这里手动替换一次 ——
 * 已经插值好的文案不含占位符,替换是空操作。
 */
export const interpolateI18n = (text: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value)),
    text
  );

/**
 * 知识库文档列表接口 —— 文档列表页与「文件处理队列」共用同一个接口
 * （`mdCode=view_knowledge_relevancy`），只是请求体参数不同。
 */
export const KNOWLEDGE_DOCUMENT_LIST_URL = `${AIPAAS_BASE_URL}/jdbc/common/basecommonlist/listJSON.do?mdCode=view_knowledge_relevancy`;

/** 接口返回的原始行。字段名以后端 listJSON.do 响应为准。 */
export type KnowledgeBaseRawDocumentRow = {
  id?: string | null;
  name?: string | null;
  flgType?: string | null;
  fileType?: string | null;
  processedTaskNum?: string | number | null;
  updateTime?: string | null;
  createTime?: string | null;
  /**
   * 解析状态码：`1` = 已解析，`-1` = 解析失败，其它 = 解析中 / 未解析。
   */
  flgSplit?: string | number | null;
  /** 解析状态描述（后端文案，如「已解析」「解析失败」）。 */
  flgSplitDesc?: string | null;
  /** 解析进度（0~100）—— 接口给的是数字或数字字符串。 */
  progress?: string | number | null;
};

/** 列表接口的响应体。 */
export type KnowledgeBaseDocumentListEnvelope = {
  Total?: number;
  Rows?: KnowledgeBaseRawDocumentRow[];
};

const pickString = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

const pickNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** 解析可缺失的数字（进度）—— 没有就是 undefined，不当成 0。 */
const pickOptionalNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * 解析状态 —— 由接口的 `flgSplit` 推出。
 *
 * `1` = 已解析，`-1` = 解析失败，其它（`0` / 缺失）按「处理中」处理 ——
 * 百分比要等后续的 `progress` 字段上线才能给。
 *
 * 没有状态码时退回描述文案（后端给的中文，如「已解析」「解析失败」）。
 */
export const resolveKnowledgeSplitStatus = (row: KnowledgeBaseRawDocumentRow): KnowledgeBaseSplitStatus => {
  const raw = row.flgSplit;
  if (raw !== null && raw !== undefined && raw !== '') {
    const code = Number(raw);
    if (Number.isFinite(code)) {
      if (code === 1) return 'done';
      if (code === -1) return 'failed';
      return 'processing';
    }
  }
  const desc = pickString(row.flgSplitDesc);
  if (desc.includes('失败')) return 'failed';
  if (desc.includes('已解析')) return 'done';
  return 'processing';
};

/** 原始行 → 领域模型。 */
export const mapKnowledgeDocumentRow = (row: KnowledgeBaseRawDocumentRow): KnowledgeBaseDocument => ({
  id: pickString(row.id),
  name: pickString(row.name),
  // `flgType` 是文件类型（'md' / 'docx' …），接口给的是小写，展示统一转大写；
  // 缺失时回落 `fileType`（数字码）。
  type: pickString(row.flgType).toUpperCase() || pickString(row.fileType),
  // 「N 条数据」—— 后端给的是字符串数字。
  records: pickNumber(row.processedTaskNum),
  updatedAt: pickString(row.updateTime),
  createdAt: pickString(row.createTime),
  // 解析状态 —— 已解析 / 解析失败 / 处理中。
  splitStatus: resolveKnowledgeSplitStatus(row),
  // 解析进度（0~100）—— 接口给的是数字或数字字符串，没有就是 undefined。
  progress: pickOptionalNumber(row.progress),
});
