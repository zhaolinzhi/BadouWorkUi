import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('@/renderer/api/projectBinding', () => ({
  getProjectBinding: vi.fn().mockResolvedValue(null),
  saveProjectBinding: vi.fn(),
  clearProjectBinding: vi.fn(),
}));

vi.mock('@/common', async () => {
  const actual = await vi.importActual<typeof import('@/common')>('@/common');
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      fs: {
        ...actual.ipcBridge.fs,
        exists: { invoke: vi.fn().mockResolvedValue(true) },
      },
      dialog: {
        ...actual.ipcBridge.dialog,
        showOpen: { invoke: vi.fn().mockResolvedValue([]) },
      },
    },
  };
});

vi.mock('@icon-park/react', () => ({
  ArrowRightUp: () => null,
  FolderOpen: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh-CN' } }),
}));

// Mock useGuidAssistantSelection (the heavy one with useCustomAgentsLoader)
vi.mock('@/renderer/pages/guid/hooks/useGuidAssistantSelection', () => ({
  useGuidAssistantSelection: () => ({
    selectedAssistantId: 'a1',
    setSelectedAssistantId: vi.fn(),
    defaultAssistantId: 'a1',
    selectedAssistant: { id: 'a1', name: 'Alpha' },
    selectedAssistantBackend: 'aionrs',
    selectedAssistantAvailable: true,
    assistants: [{ id: 'a1', name: 'Alpha', enabled: true }],
    selectedMode: 'default',
    setSelectedMode: vi.fn(),
    selectedAcpModel: null,
    setSelectedAcpModel: vi.fn(),
    currentAcpCachedModelInfo: null,
    currentAgentAvailableCommands: [],
    currentAgentModeOptions: [],
    currentThoughtLevelOption: null,
    selectedThoughtLevelValue: '',
    setSelectedThoughtLevelValue: vi.fn(),
  }),
}));

vi.mock('@/renderer/pages/guid/hooks/useGuidInput', () => ({
  useGuidInput: () => ({
    input: '',
    setInput: vi.fn(),
    files: [],
    setFiles: vi.fn(),
    dir: '',
    setDir: vi.fn(),
    isInputFocused: false,
    loading: false,
    setLoading: vi.fn(),
    handleFilesPasted: vi.fn(),
    handleFilesUploaded: vi.fn(),
    handleFilesPicked: vi.fn(),
    handleRemoveFile: vi.fn(),
    handleTextareaFocus: vi.fn(),
    handleTextareaBlur: vi.fn(),
    onPaste: vi.fn(),
    isFileDragging: false,
    dragHandlers: {},
  }),
}));

vi.mock('@/renderer/pages/guid/hooks/useGuidSend', () => ({
  useGuidSend: () => ({
    sendMessageHandler: vi.fn(),
    isButtonDisabled: false,
  }),
}));

vi.mock('@/renderer/pages/guid/hooks/useGuidModelSelection', () => ({
  useGuidModelSelection: () => ({
    modelList: [],
    current_model: null,
    setCurrentModel: vi.fn(),
    resetCurrentModel: vi.fn(),
    isGoogleAuth: false,
  }),
}));

vi.mock('@/renderer/pages/guid/hooks/useTypewriterPlaceholder', () => ({
  useTypewriterPlaceholder: () => '',
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'tester', token: 'tok' }, status: 'authenticated' }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@/renderer/components/chat/SpeechInputButton', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/guid/components/GuidInputCard', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/guid/components/AssistantSelectionArea', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/guid/components/GuidModelSelector', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/guid/components/GuidActionRow', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/guid/components/QuickActionButtons', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/FeedbackReportModal', () => ({
  default: () => null,
}));

vi.mock('@/renderer/hooks/file/useOpenFileSelector', () => ({
  useOpenFileSelector: () => ({ onSlashBuiltinCommand: vi.fn() }),
}));

vi.mock('@/renderer/hooks/file/useDragUpload', () => ({
  useDragUpload: () => ({ isFileDragging: false, dragHandlers: {} }),
}));

vi.mock('@/renderer/hooks/file/usePasteService', () => ({
  usePasteService: () => ({ onPaste: vi.fn(), onFocus: vi.fn() }),
}));

vi.mock('@/renderer/hooks/chat/useSendBoxDraft', () => ({
  appendPromptToDraft: (draft: string, prompt: string) => draft + prompt,
}));

vi.mock('@/renderer/hooks/chat/useSlashCommandController', () => ({
  useSlashCommandController: () => ({
    isOpen: false,
    filteredCommands: [],
    query: '',
    activeIndex: 0,
    setActiveIndex: vi.fn(),
    onKeyDown: () => false,
    onSelectByIndex: vi.fn(),
  }),
  getFuzzyMatchIndices: () => null,
}));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => ({
    activeBorderColor: '',
    inactiveBorderColor: '',
    activeShadow: '',
  }),
}));

vi.mock('@/renderer/hooks/system/useSpeechInput', () => ({
  appendSpeechTranscript: (a: string, b: string) => a + b,
}));

vi.mock('@/renderer/hooks/system/useLiveTranscriptInsertion', () => ({
  useLiveTranscriptInsertion: () => ({ handleLiveTranscript: vi.fn() }),
}));

vi.mock('@/renderer/hooks/mcp/catalog', () => ({
  ensureBackendMcpCatalog: vi.fn().mockResolvedValue({ allServers: [] }),
}));

import GuidPage from '@/renderer/pages/guid/GuidPage';
import { makeBinding } from '../../../fixtures/projectBinding';

import { getProjectBinding } from '@/renderer/api/projectBinding';

const mockedGet = vi.mocked(getProjectBinding);

const renderAt = (state: object): void => {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/guid', state }]}>
      <Routes>
        <Route path='/guid' element={<GuidPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('GuidPage binding flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未绑定时 modal 出现', async () => {
    mockedGet.mockResolvedValueOnce(null);
    renderAt({ projectId: 'p1', projectName: 'Demo', requireBinding: true });
    await waitFor(() => expect(screen.getByTestId('project-binding-modal-p1')).toBeInTheDocument());
  });

  it('已绑定且有效时显示 BoundBadge', async () => {
    mockedGet.mockResolvedValueOnce(makeBinding());
    renderAt({ projectId: 'p1', projectName: 'Demo', requireBinding: true });
    await waitFor(() => expect(screen.getByTestId('bound-badge')).toBeInTheDocument());
  });
});