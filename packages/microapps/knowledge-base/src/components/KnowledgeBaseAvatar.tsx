/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseListItem } from '../types';
import { AppIcon } from '@aionui/ui';
import React from 'react';
import { isEmoji, resolveIconImageSrc } from '../utils/knowledgeBaseUtils';
import styles from './KnowledgeBaseAvatar.module.css';

type KnowledgeBaseAvatarProps = {
  knowledgeBase: KnowledgeBaseListItem;
  size?: number;
};

const KnowledgeBaseAvatar: React.FC<KnowledgeBaseAvatarProps> = ({ knowledgeBase, size = 32 }) => {
  const resolvedIcon = knowledgeBase.icon?.trim();
  const hasEmojiIcon = Boolean(resolvedIcon && isEmoji(resolvedIcon));
  const iconImage = resolveIconImageSrc(resolvedIcon);
  const iconSize = Math.floor(size * 0.5);
  const emojiSize = Math.floor(size * 0.6);

  return (
    <div className={styles.symbol} style={{ width: size, height: size }}>
      {iconImage ? (
        <img src={iconImage} alt='' className={styles.image} />
      ) : hasEmojiIcon ? (
        <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{resolvedIcon}</span>
      ) : (
        <AppIcon name='book' size={iconSize} />
      )}
    </div>
  );
};

export default KnowledgeBaseAvatar;
