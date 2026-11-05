/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync as _mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { getPlatformServices } from '@/common/platform';
import { application } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';
import type {
  IChatConversationRefer,
  IEnvStorageRefer,
  ILegacyConfigStorageRefer,
  TChatConversation,
  TProviderWithModel,
} from '@/common/config/storage';
import { ConfigStorage, EnvStorage } from '@/common/config/storage';
import {
  copyDirectoryRecursively,
  ensureDirectory,
  getConfigPath,
  getDataPath,
  getTempPath,
  hasElectronAppPath,
  verifyDirectoryFiles,
} from './utils';
import { runLegacyDatabaseMigrations } from '@process/services/database/runLegacyDatabaseMigrations';
import { getActiveScope } from '@process/account/accountScope';
import { BUILTIN_IMAGE_GEN_ID } from '../resources/builtinMcp/constants';
// Platform and architecture types (moved from deleted updateConfig)
type PlatformType = 'win32' | 'darwin' | 'linux';
type ArchitectureType = 'x64' | 'arm64' | 'ia32' | 'arm';

const nodePath = path;

const STORAGE_PATH = {
  config: 'aionui-config.txt',
  chatMessage: 'aionui-chat-message.txt',
  chat: 'aionui-chat.txt',
  env: '.aionui-env',
  assistants: 'assistants',
  skills: 'skills',
  cronSkills: 'cron-skills',
};

/** Legacy builtin-skills cache directory, cleaned up at startup after the
 * backend took ownership of the corpus. */
const LEGACY_BUILTIN_SKILLS_DIR = 'builtin-skills';

/**
 * The config directory for the active account.
 *
 * A function, not a constant: `getConfigPath()` resolves through the active
 * account scope, so binding it at module load would freeze the shared
 * directory before any account is known.
 */
const getHomePage = (): string => getConfigPath();

const mkdirSync = (path: string) => {
  return _mkdirSync(path, { recursive: true });
};

/**
 * 迁移老版本数据从temp目录到userData/config目录
 */
const migrateLegacyData = async () => {
  const oldDir = getTempPath(); // 老的temp目录
  const newDir = getConfigPath(); // 新的userData/config目录

  try {
    // 检查新目录是否为空（不存在或者存在但无内容）
    const isNewDirEmpty =
      !existsSync(newDir) ||
      (() => {
        try {
          return existsSync(newDir) && readdirSync(newDir).length === 0;
        } catch (error) {
          console.warn('[AionUi] Warning: Could not read new directory during migration check:', error);
          return false; // 假设非空以避免迁移覆盖
        }
      })();

    // 检查迁移条件：老目录存在且新目录为空
    if (existsSync(oldDir) && isNewDirEmpty) {
      // 创建目标目录
      mkdirSync(newDir);

      // 复制所有文件和文件夹
      await copyDirectoryRecursively(oldDir, newDir);

      // 验证迁移是否成功
      const isVerified = await verifyDirectoryFiles(oldDir, newDir);
      if (isVerified) {
        // 确保不会删除相同的目录
        if (path.resolve(oldDir) !== path.resolve(newDir)) {
          try {
            await fs.rm(oldDir, { recursive: true });
          } catch (cleanupError) {
            console.warn('[AionUi] 原目录清理失败，请手动删除:', oldDir, cleanupError);
          }
        }
      }

      return true;
    }
  } catch (error) {
    console.error('[AionUi] 数据迁移失败:', error);
  }

  return false;
};

const WriteFile = async (file_path: string, data: string) => {
  // Ensure parent directory exists to prevent ENOENT on first write
  const dir = nodePath.dirname(file_path);
  await fs.mkdir(dir, { recursive: true });
  return fs.writeFile(file_path, data);
};

/**
 * In-memory JSON store backed by a file on disk.
 *
 * Data is loaded once (synchronously on first access) and kept in memory.
 * - `get` / `getSync` read from the in-memory cache (microseconds).
 * - `set` / `remove` / `clear` update the cache first, then persist to disk.
 * - Disk writes are serialized via a simple promise chain to prevent corruption.
 *
 * The on-disk format stays base64(encodeURIComponent(JSON)) for backward compat.
 */
const JsonFileBuilder = <S extends object = Record<string, unknown>>(file_path: string) => {
  // -- encoding helpers (unchanged, keeps backward compat) --
  const encode = (data: unknown) => btoa(encodeURIComponent(String(data)));
  const decode = (base64: string) => decodeURIComponent(atob(base64));

  // -- in-memory cache --
  let cache: S | null = null;

  const loadSync = (): S => {
    try {
      const raw = readFileSync(file_path).toString();
      if (!raw || raw.trim() === '') return {} as S;
      const decoded = decode(raw);
      if (!decoded || decoded.trim() === '') return {} as S;
      const parsed = JSON.parse(decoded) as S;
      if (file_path.includes('chat.txt') && Object.keys(parsed).length === 0) {
        console.warn(`[Storage] Chat history file appears to be empty: ${file_path}`);
      }
      return parsed;
    } catch {
      return {} as S;
    }
  };

  const ensureLoaded = (): S => {
    if (cache === null) {
      cache = loadSync();
    }
    return cache;
  };

  // -- serialized disk persistence --
  let writeChain: Promise<unknown> = Promise.resolve();

  const persist = (): Promise<S> => {
    const data = cache ?? ({} as S);
    const encoded = encode(JSON.stringify(data));
    // Write once, branch the promise: writeChain stays resolved (so one
    // failure doesn't block subsequent writes), callers get the real error.
    const writeOp = writeChain.then(() => WriteFile(file_path, encoded));
    writeChain = writeOp.catch(() => {});
    return writeOp.then(
      () => data,
      (err) => {
        console.error(`[Storage] Failed to persist ${file_path}:`, err);
        throw err;
      }
    );
  };

  // -- public API (same shape as before) --
  const toJson = async (): Promise<S> => ensureLoaded();

  const setJson = async (data: S): Promise<S> => {
    cache = data;
    return persist();
  };

  const toJsonSync = (): S => ensureLoaded();

  return {
    toJson,
    setJson,
    toJsonSync,
    async set<K extends keyof S>(key: K, value: Awaited<S>[K]): Promise<Awaited<S>[K]> {
      const data = ensureLoaded();
      data[key] = value;
      await persist();
      return value;
    },
    async get<K extends keyof S>(key: K): Promise<Awaited<S>[K]> {
      return ensureLoaded()[key] as Awaited<S>[K];
    },
    async remove<K extends keyof S>(key: K) {
      const data = ensureLoaded();
      delete data[key];
      return persist();
    },
    clear() {
      cache = {} as S;
      return persist();
    },
    getSync<K extends keyof S>(key: K): S[K] {
      return ensureLoaded()[key];
    },
    update<K extends keyof S>(key: K, updateFn: (value: S[K], data: S) => Promise<S[K]>) {
      const data = ensureLoaded();
      return updateFn(data[key], data).then((value) => {
        data[key] = value;
        return persist();
      });
    },
    backup(fullName: string) {
      const dir = nodePath.dirname(fullName);
      if (!existsSync(dir)) {
        mkdirSync(dir);
      }
      // Backup: copy the file then remove original
      const doCopy = () => fs.copyFile(file_path, fullName).then(() => fs.rm(file_path, { recursive: true }));
      const backupOp = writeChain.then(doCopy);
      writeChain = backupOp.catch(() => {});
      return backupOp.then(
        () => {},
        (err) => {
          console.error(`[Storage] Backup failed:`, err);
          throw err;
        }
      );
    },
  };
};

type ConversationHistoryData = Record<string, TMessage[]>;

type StorageHandle<T extends object> = ReturnType<typeof JsonFileBuilder<T>>;

/**
 * Storage handles, resolved against the account that is active when
 * `initStorage()` runs.
 *
 * These used to be module-level constants, which froze `cacheDir` at import
 * time — before any account was known. Per-account isolation needs them to
 * follow the active account scope, so they are built lazily and can be
 * rebuilt when the account changes.
 */
type StorageHandles = {
  envFile: StorageHandle<IEnvStorageRefer>;
  configFile: StorageHandle<ILegacyConfigStorageRefer>;
  chatFile: StorageHandle<IChatConversationRefer>;
  chatMessageFile: StorageHandle<ConversationHistoryData>;
  cacheDir: string;
  dirConfig: { cacheDir?: string; workDir?: string; logDir?: string } | undefined;
};

let storageHandles: StorageHandles | null = null;
/** The account scope the current handles were built for. */
let storageHandlesScopeKey: string | null = null;

function buildStorageHandles(): StorageHandles {
  const envFile = JsonFileBuilder<IEnvStorageRefer>(path.join(getHomePage(), STORAGE_PATH.env));
  const dirConfig = envFile.getSync('aionui.dir');
  const cacheDir = dirConfig?.cacheDir || getHomePage();
  const configFile = JsonFileBuilder<ILegacyConfigStorageRefer>(path.join(cacheDir, STORAGE_PATH.config));
  const chatFile = JsonFileBuilder<IChatConversationRefer>(path.join(cacheDir, STORAGE_PATH.chat));
  const chatMessageFile = JsonFileBuilder<ConversationHistoryData>(path.join(cacheDir, STORAGE_PATH.chatMessage));
  return { envFile, configFile, chatFile, chatMessageFile, cacheDir, dirConfig };
}

/**
 * The current storage handles.
 *
 * Falls back to building them on demand so that a caller which runs before
 * `initStorage()` still gets a usable handle instead of a crash.
 *
 * The handles are rebuilt when the active account changes — the account's
 * directories are different, so the old handles would write into the
 * previous account's files.
 */
function handles(): StorageHandles {
  const scopeKey = getActiveScope()?.key ?? null;
  if (!storageHandles || storageHandlesScopeKey !== scopeKey) {
    storageHandles = buildStorageHandles();
    storageHandlesScopeKey = scopeKey;
  }
  return storageHandles;
}

/**
 * Discard the current handles so the next access rebuilds them against the
 * currently active account scope. Used when the signed-in account changes.
 */
export function resetStorageHandles(): void {
  storageHandles = null;
}

const buildMessageListStorage = (conversation_id: string, dir: string) => {
  const fullName = path.join(dir, 'aionui-chat-history', conversation_id + '.txt');
  if (!existsSync(fullName)) {
    mkdirSync(path.join(dir, 'aionui-chat-history'));
  }
  return JsonFileBuilder<TMessage[]>(path.join(dir, 'aionui-chat-history', conversation_id + '.txt'));
};

const conversationHistoryProxy = (options: StorageHandle<ConversationHistoryData>, dir: string) => {
  return {
    ...options,
    async set(key: string, data: TMessage[]) {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      return await storage.setJson(data);
    },
    async get(key: string): Promise<TMessage[]> {
      const conversation_id = key;
      const storage = buildMessageListStorage(conversation_id, dir);
      const data = await storage.toJson();
      if (Array.isArray(data)) return data;
      return [];
    },
    backup(conversation_id: string) {
      const storage = buildMessageListStorage(conversation_id, dir);
      return storage.backup(
        path.join(dir, 'aionui-chat-history', 'backup', conversation_id + '_' + Date.now() + '.txt')
      );
    },
  };
};

/**
 * The per-conversation message history, proxied onto the current account's
 * cache directory.
 */
const getChatMessageFile = () => conversationHistoryProxy(handles().chatMessageFile, handles().cacheDir);

/**
 * 获取助手规则目录路径
 * Get assistant rules directory path
 */
const getAssistantsDir = () => {
  return path.join(handles().cacheDir, STORAGE_PATH.assistants);
};

/**
 * 获取技能脚本目录路径
 * Get skills scripts directory path
 */
const getSkillsDir = () => {
  return path.join(handles().cacheDir, STORAGE_PATH.skills);
};

/**
 * Get the directory for per-cron-job SKILL.md files.
 * Each cron job gets its own subdirectory: {cronSkillsDir}/{job_id}/SKILL.md
 */
const getCronSkillsDir = () => {
  return path.join(handles().cacheDir, STORAGE_PATH.cronSkills);
};

/**
 * Best-effort cleanup of the legacy `{cacheDir}/builtin-skills/` directory
 * left behind by versions prior to the backend taking ownership of the skill
 * corpus. Failures are swallowed — at worst a stale copy lingers on disk.
 */
const cleanupLegacyBuiltinSkillsDir = () => {
  const legacyDir = path.join(handles().cacheDir, LEGACY_BUILTIN_SKILLS_DIR);
  if (!existsSync(legacyDir)) return;
  fs.rm(legacyDir, { recursive: true, force: true })
    .then(() => console.log('[AionUi] Cleaned up legacy builtin-skills cache'))
    .catch(() => {
      /* swallow — cleanup is not critical */
    });
};

/**
 * Ensure user-facing config directories exist. Built-in assistant rules and
 * skill files are now owned by the backend (see
 * `crates/aionui-app/assets/builtin-assistants/` and
 * `crates/aionui-app/assets/builtin-skills/`) — neither is synced from
 * renderer resources anymore.
 */
const ensureAssistantDirs = async (): Promise<void> => {
  const assistantsDir = getAssistantsDir();
  const userSkillsDir = getSkillsDir();

  if (!existsSync(userSkillsDir)) mkdirSync(userSkillsDir);

  const cronSkillsDir = getCronSkillsDir();
  if (!existsSync(cronSkillsDir)) mkdirSync(cronSkillsDir);

  if (!existsSync(assistantsDir)) mkdirSync(assistantsDir);
};

const getBuiltinMcpBaseDir = (): string => {
  const mainModuleDir =
    typeof require !== 'undefined' && require.main?.filename ? path.dirname(require.main.filename) : __dirname;
  const baseDir = path.basename(mainModuleDir) === 'chunks' ? path.dirname(mainModuleDir) : mainModuleDir;
  // In packaged mode the main bundle lives inside app.asar, but external node
  // processes cannot read files from ASAR archives. Redirect to the unpacked copy.
  if (getPlatformServices().paths.isPackaged()) {
    return baseDir.replace('app.asar', 'app.asar.unpacked');
  }
  return baseDir;
};

/**
 * Resolve the path to a built-in MCP server entry script.
 * In development the file lives next to the main process bundle (out/main/);
 * in production it's inside the packaged app.
 */
const getBuiltinMcpScriptPath = (scriptName: string): string => {
  // initStorage may itself be code-split into out/main/chunks/.
  // Built-in MCP entry files are emitted next to the main entry in out/main/.
  return path.resolve(getBuiltinMcpBaseDir(), `${scriptName}.js`);
};

const initStorage = async () => {
  const t0 = performance.now();
  const mark = (label: string) => console.log(`[AionUi:init] ${label} +${Math.round(performance.now() - t0)}ms`);
  mark('start');

  // 0. Build the storage handles against the account that is active now.
  // The account scope must already be set by the caller (see index.ts) before
  // this runs, otherwise the handles freeze on the shared directory.
  storageHandles = buildStorageHandles();
  mark('0. buildStorageHandles');

  // 1. 先执行数据迁移（在任何目录创建之前）
  await migrateLegacyData();
  mark('1. migrateLegacyData');

  // 2. 创建必要的目录（迁移后再创建，确保迁移能正常进行）
  // Use ensureDirectory to handle cases where a regular file blocks the path (#841)
  ensureDirectory(getHomePage());
  ensureDirectory(getDataPath());

  // 3. 初始化存储系统
  ConfigStorage.interceptor(handles().configFile);
  EnvStorage.interceptor(handles().envFile);
  mark('3. storage interceptors');

  mark('4. MCP config initialization skipped');

  // 5. Ensure assistant-related directories exist. Built-in assistant records
  //    now live in the backend SQLite catalog (see aionui-assistant crate) and
  //    are no longer seeded into ConfigStorage. User-authored rule md files
  //    continue to live under `{cacheDir}/assistants/` until the one-shot
  //    migration (T3b) imports them into the backend.
  try {
    await ensureAssistantDirs();
    mark('5. ensureAssistantDirs');
  } catch (error) {
    console.error('[AionUi] Failed to ensure assistant dirs:', error);
  }

  // 5b. Best-effort cleanup of the legacy builtin-skills cache left behind
  //     before the backend took ownership of the corpus.
  cleanupLegacyBuiltinSkillsDir();
  mark('5b. legacyBuiltinSkillsCleanup');

  // 6. Backend only understands the v26-era schema baseline. Older desktop
  //    users may still have a pre-v26 Electron-managed catalog, so we upgrade
  //    that file here, close it, and only then allow the backend to start.
  const legacyDbMigration = await runLegacyDatabaseMigrations();
  const repaired = legacyDbMigration.handoffRepair.repairedColumns.length;
  if (legacyDbMigration.skipped) {
    mark('6. legacyDbMigrations skipped');
  } else if (legacyDbMigration.migrated) {
    mark(
      `6. legacyDbMigrations v${legacyDbMigration.fromVersion}->v${legacyDbMigration.toVersion} handoffRepair=${repaired}`
    );
  } else {
    mark(`6. legacyDbMigrations noop(v${legacyDbMigration.fromVersion}) handoffRepair=${repaired}`);
  }

  if (hasElectronAppPath()) {
    application.systemInfo.provider(() => {
      return Promise.resolve(getSystemDir());
    });
  }
  mark('done');
};

/**
 * The local config file, forwarded to the handle of the active account.
 *
 * The exported object is stable for the lifetime of the process, but every
 * call resolves against the handles built for the account that is active at
 * call time. `get` stays async and `getSync` stays sync — callers depend on
 * both shapes.
 */
export const ProcessConfig = {
  get: <K extends keyof ILegacyConfigStorageRefer>(key: K) => handles().configFile.get(key),
  getSync: <K extends keyof ILegacyConfigStorageRefer>(key: K) => handles().configFile.getSync(key),
  set: <K extends keyof ILegacyConfigStorageRefer>(key: K, value: ILegacyConfigStorageRefer[K]) =>
    handles().configFile.set(key, value),
  remove: <K extends keyof ILegacyConfigStorageRefer>(key: K) => handles().configFile.remove(key),
  update: <K extends keyof ILegacyConfigStorageRefer>(
    key: K,
    updateFn: (
      value: ILegacyConfigStorageRefer[K],
      data: ILegacyConfigStorageRefer
    ) => Promise<ILegacyConfigStorageRefer[K]>
  ) => handles().configFile.update(key, updateFn),
  toJson: () => handles().configFile.toJson(),
  toJsonSync: () => handles().configFile.toJsonSync(),
  setJson: (data: ILegacyConfigStorageRefer) => handles().configFile.setJson(data),
  clear: () => handles().configFile.clear(),
  backup: (fullName: string) => handles().configFile.backup(fullName),
};

export const ProcessChat = {
  get: <K extends keyof IChatConversationRefer>(key: K) => handles().chatFile.get(key),
  getSync: <K extends keyof IChatConversationRefer>(key: K) => handles().chatFile.getSync(key),
  set: <K extends keyof IChatConversationRefer>(key: K, value: IChatConversationRefer[K]) =>
    handles().chatFile.set(key, value),
  remove: <K extends keyof IChatConversationRefer>(key: K) => handles().chatFile.remove(key),
  toJson: () => handles().chatFile.toJson(),
  toJsonSync: () => handles().chatFile.toJsonSync(),
};

export const ProcessChatMessage = {
  get: (conversation_id: string) => getChatMessageFile().get(conversation_id),
  set: (conversation_id: string, data: TMessage[]) => getChatMessageFile().set(conversation_id, data),
  backup: (conversation_id: string) => getChatMessageFile().backup(conversation_id),
};

export const ProcessEnv = {
  get: <K extends keyof IEnvStorageRefer>(key: K) => handles().envFile.get(key),
  getSync: <K extends keyof IEnvStorageRefer>(key: K) => handles().envFile.getSync(key),
  set: <K extends keyof IEnvStorageRefer>(key: K, value: IEnvStorageRefer[K]) => handles().envFile.set(key, value),
  remove: <K extends keyof IEnvStorageRefer>(key: K) => handles().envFile.remove(key),
};

export const getSystemDir = () => {
  const { dirConfig, cacheDir } = handles();
  // electron-log writes to the platform-standard logs directory
  const logDir = dirConfig?.logDir || getPlatformServices().paths.getLogsDir();

  return {
    cacheDir: cacheDir,
    // getDataPath() returns CLI-safe path (symlink on macOS) to avoid spaces
    // getDataPath() 返回 CLI 安全路径（macOS 上的符号链接）以避免空格问题
    workDir: dirConfig?.workDir || getDataPath(),
    logDir,
    platform: process.platform as PlatformType,
    arch: process.arch as ArchitectureType,
  };
};

/**
 * 获取助手规则目录路径（供其他模块使用）
 * Get assistant rules directory path (for use by other modules)
 */
export { getAssistantsDir, getSkillsDir, getCronSkillsDir, BUILTIN_IMAGE_GEN_ID, getBuiltinMcpScriptPath };

export default initStorage;
