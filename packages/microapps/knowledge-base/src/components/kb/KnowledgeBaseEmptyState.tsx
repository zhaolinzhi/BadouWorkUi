/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 知识库空态 —— 设计稿的 `.kb-empty`。
 *
 * 为什么不用共享的 `EmptyState`：
 * 共享组件的图标位只能放一个图标，而设计稿这里是**插画**（七层叠出来的），
 * 排版也不同（标题 18px/500、上下留白 24px/12px）。这两点共享组件表达不了，
 * 所以知识库自己实现一份。
 */

import KnowledgeBaseEmptyIllustration from './KnowledgeBaseEmptyIllustration';
import React from 'react';
import styles from './KnowledgeBaseEmptyState.module.css';

export type KnowledgeBaseEmptyStateProps = {
  /** 主文案。 */
  title: React.ReactNode;
  /** 辅助说明。省略时整段不渲染。 */
  description?: React.ReactNode;
  /** 操作入口。省略时整块不渲染。 */
  action?: React.ReactNode;
};

const KnowledgeBaseEmptyState: React.FC<KnowledgeBaseEmptyStateProps> = ({ title, description, action }) => (
  <div className={styles.empty} data-testid='empty-state'>
    <KnowledgeBaseEmptyIllustration />
    <h2 className={styles.title} data-testid='empty-state-title'>
      {title}
    </h2>
    {description ? (
      <p className={styles.description} data-testid='empty-state-description'>
        {description}
      </p>
    ) : null}
    {action ? <div className={styles.action}>{action}</div> : null}
  </div>
);

export default KnowledgeBaseEmptyState;
