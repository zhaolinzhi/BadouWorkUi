/**
 * 项目绑定 HTTP 封装。
 *
 * 走 `ipcBridge.projectBinding`(统一 aioncore HTTP)。
 *
 * Mock 仅用于本地调试,通过 `globalThis.__aionuiMockProjectBinding = true` 启用:
 *   1. 在 DevTools console 赋值
 *   2. vite 插件通过 `define` 注入
 *
 * 当 mock 启用时,所有调用走 in-memory store(挂载在 `globalThis.__mockProjectBinding`),
 * 并通过 localStorage 跨刷新持久化。
 *
 * 错误处理:任何 backend 错误(404/5xx/网络错)直接抛出,不自动 fallback。
 * UI 层(ProjectBindingModal)展示错误,用户可重试或关闭 modal。
 */
import type { ProjectBinding } from './types';
import { ipcBridge } from '@/common';
import { isBackendHttpError } from '@/common/adapter/httpBridge';

type GlobalWithFlags = typeof globalThis & {
  __aionuiMockProjectBinding?: boolean;
  __mockProjectBinding?: MockStore;
};

const getMockEnabled = (): boolean => (globalThis as GlobalWithFlags).__aionuiMockProjectBinding === true;

type MockStore = Map<string, ProjectBinding>;

const getMockStore = (): MockStore => {
  const g = globalThis as GlobalWithFlags;
  if (!g.__mockProjectBinding) {
    g.__mockProjectBinding = new Map<string, ProjectBinding>();
    try {
      const raw = localStorage.getItem('__mockProjectBinding');
      if (raw) {
        const parsed = JSON.parse(raw) as Array<[string, ProjectBinding]>;
        for (const [k, v] of parsed) g.__mockProjectBinding.set(k, v);
      }
    } catch {
      // 损坏的 localStorage 静默处理
    }
  }
  return g.__mockProjectBinding;
};

const persistMock = (store: MockStore): void => {
  try {
    localStorage.setItem('__mockProjectBinding', JSON.stringify(Array.from(store.entries())));
  } catch {
    // localStorage 不可用时静默
  }
};

/**
 * 抛出一个用户友好的错误信息,从 BackendHttpError 中提取 backendMessage(code 已知时)。
 */
const toUserError = (e: unknown, fallback: string): Error => {
  if (isBackendHttpError(e)) {
    const code = e.code ? ` [${e.code}]` : '';
    return new Error(`${e.backendMessage || fallback}${code}`);
  }
  return e instanceof Error ? e : new Error(String(e) || fallback);
};

export const getProjectBinding = async (projectId: string): Promise<ProjectBinding | null> => {
  if (getMockEnabled()) {
    return getMockStore().get(projectId) ?? null;
  }
  try {
    const { binding } = await ipcBridge.projectBinding.get.invoke({ project_id: projectId });
    return binding;
  } catch (e) {
    // 404 = resource doesn't exist for this user (not "route not found").
    // For ambiguous 404 (route not registered), BackendHttpError carries
    // code === 'NOT_FOUND' / message === 'Route not found.', which we
    // surface verbatim so the caller knows the backend is missing the route.
    throw toUserError(e, 'Failed to load project binding');
  }
};

export const saveProjectBinding = async (input: {
  projectId: string;
  assistantId: string;
  folderPath: string;
}): Promise<ProjectBinding> => {
  if (getMockEnabled()) {
    const binding: ProjectBinding = {
      projectId: input.projectId,
      assistantId: input.assistantId,
      folderPath: input.folderPath,
      updatedAt: new Date().toISOString(),
    };
    const store = getMockStore();
    store.set(input.projectId, binding);
    persistMock(store);
    return binding;
  }
  try {
    const { binding } = await ipcBridge.projectBinding.put.invoke({
      project_id: input.projectId,
      assistantId: input.assistantId,
      folderPath: input.folderPath,
    });
    return binding;
  } catch (e) {
    throw toUserError(e, 'Failed to save project binding');
  }
};

export const clearProjectBinding = async (projectId: string): Promise<void> => {
  if (getMockEnabled()) {
    const store = getMockStore();
    store.delete(projectId);
    persistMock(store);
    return;
  }
  try {
    await ipcBridge.projectBinding.remove.invoke({ project_id: projectId });
  } catch (e) {
    throw toUserError(e, 'Failed to clear project binding');
  }
};
