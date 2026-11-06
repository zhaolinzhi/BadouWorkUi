/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 首页「对话栏」对齐设计稿的结构性守卫。
 *
 * 设计稿(BadouWork-Desktop-Handoff/preview/index.html)里首页输入区由三层组成:
 *   .composer-group  —— 定位上下文(白卡 + 下面那层灰色项目托盘)
 *   .project-tray    —— 贴在白卡下方的灰底托盘,文字贴底
 *   .composer        —— 150px 高的白卡,圆角 24px,内含 textarea + 工具栏
 * 工具栏里是 36px 的圆形「+」和圆形渐变发送按钮。
 *
 * 这些断言盯的是「类名契约」——组件必须用 CSS Module 里那几个类,
 * 而不是临时用内联样式或 UnoCSS 覆盖顶掉设计稿的数值。
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import styles from '@/renderer/pages/guid/index.module.css';

// 这些用例要真渲染 Arco 组件,单跑也要好几秒;与其它重型 dom 测试并跑时
// 会撞上默认的 10s 预算。放宽本文件的预算,避免在 CI 上偶发超时。
vi.setConfig({ testTimeout: 30000 });

vi.mock('@/common', () => ({
  ipcBridge: {
    dialog: {
      showOpen: { invoke: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock('react-i18next', () => ({
  // 直接回显 key —— 断言「用了哪个 i18n key」比断言「文案长什么样」稳。
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@/renderer/hooks/chat/useCompositionInput', () => ({
  useCompositionInput: () => ({
    compositionHandlers: {},
    isComposing: { current: false },
  }),
}));

vi.mock('@/renderer/hooks/chat/useAtMentionItems', () => ({
  useAtMentionItems: () => ({ items: [], loading: false }),
}));

vi.mock('@/renderer/components/media/FilePreview', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/media/UploadProgressBar', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/chat/AtFileMenu', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/base', () => ({
  AionInlineSearchInput: () => null,
}));

vi.mock('@/renderer/components/workspace', () => ({
  getRecentWorkspaces: () => [],
  addRecentWorkspace: vi.fn(),
}));

vi.mock('@/renderer/services/FileService', () => ({
  getCleanFileNames: (files: string[]) => files,
  FileService: { processDroppedFiles: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

vi.mock('@/renderer/components/chat/MobileActionSheet', () => ({
  default: () => null,
}));

// 把「授权模式」选择器替换成直接吐出图标 —— 这样能断言首页传下去的
// 是设计稿定制的图标,而不是 icon-park 的通用图形。
vi.mock('@/renderer/components/agent/AgentModeSelector', () => ({
  default: ({
    compactLeadingIcon,
    compactTrailingIcon,
  }: {
    compactLeadingIcon?: React.ReactNode;
    compactTrailingIcon?: React.ReactNode;
  }) => (
    <div data-testid='agent-mode-selector'>
      {compactLeadingIcon}
      {compactTrailingIcon}
    </div>
  ),
}));

const noop = () => {};

const inputCardProps = {
  input: '',
  onInputChange: noop,
  onKeyDown: noop,
  onPaste: noop as unknown as React.ClipboardEventHandler,
  onFocus: noop,
  onBlur: noop,
  placeholder: 'placeholder',
  isFileDragging: false,
  dragHandlers: {},
  files: [],
  onRemoveFile: noop,
  workspaceDir: '',
  onSelectWorkspace: noop,
  onClearWorkspace: noop,
  actionRow: null,
};

const actionRowProps = {
  files: [],
  onFilesUploaded: noop,
  onFilesPicked: noop,
  modelSelectorNode: null,
  isGeminiMode: false,
  modelList: [],
  current_model: undefined,
  setCurrentModel: vi.fn(),
  currentAcpCachedModelInfo: null,
  selectedAcpModel: null,
  setSelectedAcpModel: vi.fn(),
  selectedMode: '',
  onModeSelect: noop,
  allSkills: [],
  disabledBuiltinSkills: [],
  enabledSkills: [],
  onToggleSkill: noop,
  mcpServers: [],
  selectedMcpServerIds: [],
  onToggleMcpServer: noop,
  loading: false,
  isButtonDisabled: false,
  onSend: noop,
};

describe('GuidInputCard —— 设计稿输入区结构', () => {
  it('把项目托盘底色层渲染在白卡下面', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...inputCardProps} />);

    const tray = container.querySelector(`.${styles.projectTrayBg}`);
    expect(tray).not.toBeNull();
    // 纯装饰层 —— 不该被读屏软件念出来,也不该挡住下面的按钮。
    expect(tray?.getAttribute('aria-hidden')).toBe('true');

    // DOM 顺序:托盘先于白卡,白卡靠 z-index 压在上面。
    const card = container.querySelector(`.${styles.guidInputInner}`);
    expect(card).not.toBeNull();
    const siblings = Array.from(tray!.parentElement!.children);
    expect(siblings.indexOf(tray as Element)).toBeLessThan(siblings.indexOf(card as Element));
  });

  it('白卡用设计稿的圆角类,外层不再裁剪投影', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...inputCardProps} />);

    const wrap = container.querySelector(`.${styles.guidInputCardWrap}`);
    expect(wrap).not.toBeNull();
    // 外层只当定位上下文用。裁掉 overflow 会把设计稿的柔和投影和
    // 托盘的圆角一起切掉。
    expect(wrap?.className).not.toMatch(/overflow-hidden/);
  });

  it('输入框高度下限交给样式表,而不是 Arco 的 minRows 内联样式', async () => {
    const { default: GuidInputCard } = await import('@/renderer/pages/guid/components/GuidInputCard');
    const { container } = render(<GuidInputCard {...inputCardProps} />);

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.className).toContain(styles.guidInputTextarea);
    // Arco 在 minRows 是数字时会写内联 min-height,压过样式表里的 68px。
    expect((textarea as HTMLTextAreaElement).style.minHeight).toBe('');
  });
});

describe('GuidWorkspaceFootnote —— 项目托盘文案', () => {
  it('空态用 i18n key 而不是硬编码文案', async () => {
    const { default: GuidWorkspaceFootnote } = await import('@/renderer/pages/guid/components/GuidWorkspaceFootnote');
    const { container } = render(
      <GuidWorkspaceFootnote workspaceDir='' onSelectWorkspace={noop} onClearWorkspace={noop} />
    );

    const button = container.querySelector('[data-testid="workspace-selector-btn"]');
    expect(button?.textContent).toContain('guid.workspace.selectProject');
  });

  it('用设计稿定制的文件夹图标', async () => {
    const { default: GuidWorkspaceFootnote } = await import('@/renderer/pages/guid/components/GuidWorkspaceFootnote');
    const { container } = render(
      <GuidWorkspaceFootnote workspaceDir='' onSelectWorkspace={noop} onClearWorkspace={noop} />
    );

    expect(container.querySelector('.i-icon-project-folder')).not.toBeNull();
  });
});

describe('GuidActionRow —— 加号与发送按钮', () => {
  it('发送按钮用设计稿类,不再复用会话页的 send-button-custom', async () => {
    const { default: GuidActionRow } = await import('@/renderer/pages/guid/components/GuidActionRow');
    const { container } = render(<GuidActionRow {...actionRowProps} />);

    const send = container.querySelector('[data-testid="guid-send-btn"]');
    expect(send).not.toBeNull();
    expect(send?.className).toContain(styles.guidSendButton);
    // send-button-custom 带自己的禁用态底色,会盖掉设计稿的半透明渐变。
    expect(send?.className).not.toContain('send-button-custom');
  });

  it('「+」按钮用设计稿的 36px 圆形类', async () => {
    const { default: GuidActionRow } = await import('@/renderer/pages/guid/components/GuidActionRow');
    const { container } = render(<GuidActionRow {...actionRowProps} />);

    const plus = container.querySelector('[data-testid="file-upload-btn"]');
    expect(plus).not.toBeNull();
    expect(plus?.className).toContain(styles.addButton);
  });

  it('授权模式选择器用设计稿定制的权限图标与下拉尖角', async () => {
    const { default: GuidActionRow } = await import('@/renderer/pages/guid/components/GuidActionRow');
    const { container } = render(
      <GuidActionRow
        {...actionRowProps}
        dynamicModes={[{ value: 'default', label: 'Default', description: 'Ask before running' }]}
      />
    );

    expect(container.querySelector('.i-icon-permission-mode')).not.toBeNull();
    expect(container.querySelector('.i-icon-chevron-down')).not.toBeNull();
  });
});
