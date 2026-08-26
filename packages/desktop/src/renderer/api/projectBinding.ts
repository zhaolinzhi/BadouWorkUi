/**
 * 项目绑定 HTTP 封装。
 *
 * - 生产模式: 走 `ipcBridge.projectBinding`(统一 aioncore HTTP)
 * - 开发模式: 当全局存在 `window.__aionuiMockProjectBinding === true` 时,
 *   走 in-memory store(挂载在 `globalThis.__mockProjectBinding`),并通过 localStorage
 *   跨刷新持久化。便于在后端未就绪时本地调试。
 *
 * 启用 mock 的方式(任选其一):
 *   1. 启动时通过 `<script>window.__aionuiMockProjectBinding = true</script>` 注入
 *   2. 在 DevTools console 中赋值
 *   3. 在 vite 插件中通过 `define` 注入
 */
import type { ProjectBinding } from './types';
import { ipcBridge } from '@/common';

type GlobalWithFlags = typeof globalThis & {
  __aionuiMockProjectBinding?: boolean;
  __mockProjectBinding?: MockStore;
};

const USE_MOCK: boolean = (globalThis as GlobalWithFlags).__aionuiMockProjectBinding === true;

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

export const getProjectBinding = async (projectId: string): Promise<ProjectBinding | null> => {
  if (USE_MOCK) {
    return getMockStore().get(projectId) ?? null;
  }
  const { binding } = await ipcBridge.projectBinding.get.invoke({ project_id: projectId });
  return binding;
};

export const saveProjectBinding = async (input: {
  projectId: string;
  assistantId: string;
  folderPath: string;
}): Promise<ProjectBinding> => {
  if (USE_MOCK) {
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
  const { binding } = await ipcBridge.projectBinding.put.invoke({
    project_id: input.projectId,
    assistantId: input.assistantId,
    folderPath: input.folderPath,
  });
  return binding;
};

export const clearProjectBinding = async (projectId: string): Promise<void> => {
  if (USE_MOCK) {
    const store = getMockStore();
    store.delete(projectId);
    persistMock(store);
    return;
  }
  await ipcBridge.projectBinding.remove.invoke({ project_id: projectId });
};
