/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isBackendRelativeAssetPath, isLikelyLocalFilePath } from './assistantAvatar';
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
