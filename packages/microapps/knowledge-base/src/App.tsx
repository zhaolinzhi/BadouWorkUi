/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { MicroAppProps } from '@aionui/microapp-shared';
import { AppRuntimeProvider } from './AppContext';
import KnowledgeBasePage from './pages/KnowledgeBasePage';

type KnowledgeBaseAppProps = {
  /** shell 在 mount 时注入的运行时 props(见 AppContext.tsx)。 */
  runtime: MicroAppProps;
};

/**
 * 子应用根组件。
 *
 * 高度:`h-full` 是必须的 —— shell 侧占位组件的三层 flex 链
 * (`placeholder 根节点 → #knowledge-base-container → qiankun wrapper`)
 * 只保证「有确定高度」,具体多高由这一层的 `h-full` 传递下去。
 * 少了它,页面会退化成内容高度(下方大片留白)。
 */
const KnowledgeBaseApp: React.FC<KnowledgeBaseAppProps> = ({ runtime }) => (
  <AppRuntimeProvider value={runtime}>
    <div className='h-full w-full overflow-hidden bg-bg-0'>
      <KnowledgeBasePage />
    </div>
  </AppRuntimeProvider>
);

export default KnowledgeBaseApp;
