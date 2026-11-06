/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 首页顶部区块(标题 + 助手切换条 + 输入区里的模型选择器)的样式守卫。
 *
 * 设计稿里:
 *   .assistant-switch —— 999px 圆角的浅灰条,药丸之间 8px 间距
 *   .assistant       —— 32px 高的药丸;选中态是白底 + 浅蓝描边
 *   模型选择器        —— 六边形模型图标 + 下拉尖角(设计稿单独给的 SVG)
 *
 * 这里盯的是「类名 / 图标契约」:切到别的药丸样式或换回 icon-park 的通用图形,
 * 断言就会红。
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import type { IProvider, TProviderWithModel } from '@/common/config/storage';
import styles from '@/renderer/pages/guid/index.module.css';

// 与 GuideComposerDesign 同理:真渲染 Arco 组件,并跑时放宽本文件的超时预算。
vi.setConfig({ testTimeout: 30000 });

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: vi.fn(() => null),
}));

vi.mock('@/renderer/hooks/agent/useManagedAgents', () => ({
  useManagedAgentRuntimeCatalog: () => [],
}));

const noop = () => {};

function assistant(id: string, name: string, sortOrder: number): Assistant {
  return {
    id,
    source: 'builtin',
    name,
    name_i18n: {},
    description_i18n: {},
    enabled: true,
    sort_order: sortOrder,
    agent_id: `agent-${id}`,
    enabled_skills: [],
    enabled_custom_skills: [],
    disabled_builtin_skills: [],
    context_i18n: {},
    prompts: [],
    prompts_i18n: {},
    models: [],
    agent_status: 'online',
    team_selectable: true,
    deletable: false,
  } as unknown as Assistant;
}

describe('AssistantSelectionArea —— 助手切换条', () => {
  it('切换条用设计稿的圆角条类', async () => {
    const { default: AssistantSelectionArea } = await import('@/renderer/pages/guid/components/AssistantSelectionArea');
    const { container } = render(
      <AssistantSelectionArea
        selectedAssistantId='cowork'
        assistants={[assistant('cowork', 'Cowork', 20), assistant('writer', 'Writer', 10)]}
        localeKey='en-US'
        onSelectAssistant={noop}
      />
    );

    expect(container.querySelector(`.${styles.assistantSwitchBar}`)).not.toBeNull();
    expect(container.querySelector(`.${styles.assistantSwitchRow}`)).not.toBeNull();
  });

  it('选中的药丸带设计稿的选中态类,未选中的不带', async () => {
    const { default: AssistantSelectionArea } = await import('@/renderer/pages/guid/components/AssistantSelectionArea');
    const { container } = render(
      <AssistantSelectionArea
        selectedAssistantId='cowork'
        assistants={[assistant('cowork', 'Cowork', 20), assistant('writer', 'Writer', 10)]}
        localeKey='en-US'
        onSelectAssistant={noop}
      />
    );

    const selected = container.querySelector('[data-testid="preset-pill-cowork"]');
    const unselected = container.querySelector('[data-testid="preset-pill-writer"]');

    expect(selected?.className).toContain(styles.assistantPill);
    expect(selected?.className).toContain(styles.assistantPillSelected);
    expect(unselected?.className).toContain(styles.assistantPill);
    expect(unselected?.className).not.toContain(styles.assistantPillSelected);
  });

  it('「更多」按钮用设计稿定制的下拉尖角', async () => {
    const { default: AssistantSelectionArea } = await import('@/renderer/pages/guid/components/AssistantSelectionArea');
    const assistants = Array.from({ length: 12 }, (_, index) => assistant(`a-${index}`, `A ${index}`, index));
    const { container } = render(
      <AssistantSelectionArea
        selectedAssistantId='a-0'
        assistants={assistants}
        localeKey='en-US'
        onSelectAssistant={noop}
      />
    );

    const more = container.querySelector('[data-testid="assistant-more-btn"]');
    expect(more).not.toBeNull();
    expect(more?.querySelector('.i-icon-chevron-down')).not.toBeNull();
  });
});

describe('GuidModelSelector —— 模型选择器', () => {
  const provider = {
    id: 'provider-1',
    name: 'Provider One',
    models: ['model-a'],
    enabled: true,
  } as unknown as IProvider;

  const currentModel = {
    id: 'provider-1',
    name: 'Provider One',
    use_model: 'model-a',
  } as unknown as TProviderWithModel;

  it('用设计稿定制的模型图标与下拉尖角', async () => {
    const { default: GuidModelSelector } = await import('@/renderer/pages/guid/components/GuidModelSelector');
    const { container } = render(
      <GuidModelSelector
        isGeminiMode={true}
        modelList={[provider]}
        current_model={currentModel}
        setCurrentModel={vi.fn()}
        currentAcpCachedModelInfo={null}
        selectedAcpModel={null}
        setSelectedAcpModel={vi.fn()}
      />
    );

    expect(container.querySelector('.i-icon-model-selector')).not.toBeNull();
    expect(container.querySelector('.i-icon-chevron-down')).not.toBeNull();
  });
});
