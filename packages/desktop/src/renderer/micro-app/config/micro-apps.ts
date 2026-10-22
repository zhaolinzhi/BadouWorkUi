import type { MicroAppConfig } from '../types';

/**
 * 子应用注册表默认值。
 * entry 在运行时由环境变量 VITE_<NAME>_APP_ENTRY 覆盖（不可硬编码公网）。
 */
export const MICRO_APP_DEFAULTS: Record<string, Omit<MicroAppConfig, 'entry'>> = {
  'meeting-recording': {
    name: 'meeting-recording',
    activeRule: '/meeting-recording',
    container: '#meeting-recording-container',
  },
  notes: {
    name: 'notes',
    activeRule: '/notes',
    container: '#notes-container',
  },
  'knowledge-base': {
    name: 'knowledge-base',
    activeRule: '/knowledge-base',
    container: '#knowledge-base-container',
  },
};

const DEFAULT_DEV_ENTRY_BASE = '//localhost:';

function getDevEntryPort(name: string): number {
  // 端口约定：每个子应用独立 dev port
  const ports: Record<string, number> = {
    'meeting-recording': 7991,
    notes: 7992,
    'knowledge-base': 7993,
  };
  return ports[name] ?? 7999;
}

/**
 * 获取子应用配置。entry 优先读环境变量。
 * 命名规范：VITE_<UPPER_SNAKE_NAME>_APP_ENTRY
 */
export function getMicroAppConfig(name: string): MicroAppConfig {
  const defaults = MICRO_APP_DEFAULTS[name];
  if (!defaults) {
    throw new Error(`Unknown micro app: "${name}". Add it to MICRO_APP_DEFAULTS.`);
  }

  const envKey = `VITE_${name.toUpperCase().replace(/-/g, '_')}_APP_ENTRY`;
  const envEntry = (import.meta.env[envKey] as string | undefined) ?? '';
  const entry = envEntry.trim() || `${DEFAULT_DEV_ENTRY_BASE}${getDevEntryPort(name)}`;

  return { ...defaults, entry };
}
