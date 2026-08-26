import type { ProjectBinding } from '@/renderer/api/types';

export const makeBinding = (overrides: Partial<ProjectBinding> = {}): ProjectBinding => ({
  projectId: 'p1',
  assistantId: 'a1',
  folderPath: '/tmp/project-1',
  updatedAt: '2026-08-26T00:00:00.000Z',
  ...overrides,
});

export const makeProjectRow = (overrides: Partial<{ id: string; projectId: string; projectName: string }> = {}) => ({
  id: 'r1',
  projectId: 'p1',
  projectName: 'Demo Project',
  ...overrides,
});

export const makeAssistant = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: 'a1',
  name: 'Default Assistant',
  ...overrides,
});
