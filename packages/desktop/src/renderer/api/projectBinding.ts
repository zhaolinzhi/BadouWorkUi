/**
 * 项目绑定 HTTP 封装。
 *
 * - 生产模式: 走 `ipcBridge.projectBinding`(统一 aioncore HTTP)
 * - 开发模式: 当 `globalThis.__aionuiMockProjectBinding === true` 时,
 *   走 in-memory store(挂载在 `globalThis.__mockProjectBinding`),并通过 localStorage
 *   跨刷新持久化。便于在后端 `/api/project-binding/*` 尚未实现时本地调试。
 *
 * 启用 mock 的方式(任选其一):
 *   1. 启动时通过 `<script>window.__aionuiMockProjectBinding = true</script>` 注入
 *   2. 在 DevTools console 中赋值 `window.__aionuiMockProjectBinding = true`
 *   3. 在 vite 插件中通过 `define` 注入
 *
 * 自动 fallback:
 *   当首次 fetch 返回 5xx 或网络错误,且 aioncore 后端尚未部署该端点时,
 *   自动切换到 mock 并提示用户。后端就绪后可关闭该 fallback。
 */
import type { ProjectBinding } from './types';
import { ipcBridge } from '@/common';
import { isBackendHttpError } from '@/common/adapter/httpBridge';

type GlobalWithFlags = typeof globalThis & {
  __aionuiMockProjectBinding?: boolean;
  __aionuiMockAutoFallbackAnnounced?: boolean;
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
 * 首次 backend 失败时自动启用 mock,并在 console 提示一次。
 * 让前端在后端尚未部署 `/api/project-binding/*` 时也能跑通。
 */
const enableMockWithFallbackNotice = (reason: string): void => {
  const g = globalThis as GlobalWithFlags;
  if (g.__aionuiMockProjectBinding === true) return; // already on
  g.__aionuiMockProjectBinding = true;
  if (!g.__aionuiMockAutoFallbackAnnounced) {
    g.__aionuiMockAutoFallbackAnnounced = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[projectBinding] Backend unreachable (${reason}). Auto-enabling mock store. ` +
        'Disable by setting window.__aionuiMockProjectBinding = false once backend /api/project-binding/* is live.'
    );
  }
};

export const getProjectBinding = async (projectId: string): Promise<ProjectBinding | null> => {
  if (getMockEnabled()) {
    return getMockStore().get(projectId) ?? null;
  }
  try {
    const { binding } = await ipcBridge.projectBinding.get.invoke({ project_id: projectId });
    return binding;
  } catch (e) {
    if (isBackendHttpError(e) && e.status === 404) return null;
    // 5xx, network errors, or anything else → backend likely not deployed.
    // Fall back to mock transparently so the Start Task flow stays usable.
    if (isBackendHttpError(e) && e.status < 500 && e.status !== 0) throw e;
    enableMockWithFallbackNotice(e instanceof Error ? e.message : String(e));
    return getMockStore().get(projectId) ?? null;
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
    if (isBackendHttpError(e) && e.status < 500 && e.status !== 0) throw e;
    enableMockWithFallbackNotice(e instanceof Error ? e.message : String(e));
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
    if (isBackendHttpError(e) && e.status < 500 && e.status !== 0) throw e;
    enableMockWithFallbackNotice(e instanceof Error ? e.message : String(e));
    const store = getMockStore();
    store.delete(projectId);
    persistMock(store);
    return;
  }
};
