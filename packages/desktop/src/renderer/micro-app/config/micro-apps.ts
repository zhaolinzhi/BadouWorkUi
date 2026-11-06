import type { MicroAppConfig } from '../types';

/**
 * 子应用注册表默认值。
 * entry 在运行时解析，不硬编码任何地址：优先 VITE_<NAME>_APP_ENTRY，
 * 其次 VITE_MICRO_APP_ASSET_BASE（安装包内置 / CDN 共用），最后回落到 dev port。
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

/**
 * 产物分发基址。两种形态共用同一个变量，取值不同而已：
 * - 安装包内置：`app://microapps`（`bun run build:all` 注入，见 scripts/build-with-builder.js）
 * - CDN 独立部署：`https://cdn.example.com/microapps`
 *
 * 拼出来永远是 `<base>/<name>/index.html` —— 子应用产物用相对 base（`base: './'`），
 * 资源跟着 entry 走，所以同一份 dist/ 两种形态都能吃，见 docs/qiankun/06-build-and-deploy.md。
 *
 * Asset base for distributing micro app builds. Both distribution shapes share this one
 * variable and only the value differs: `app://microapps` when bundled into the installer
 * (injected by `bun run build:all`) or a CDN root when deployed standalone. It always
 * resolves to `<base>/<name>/index.html`; micro apps build with a relative base so assets
 * follow the entry, which is what lets one dist serve both shapes.
 */
function getAssetEntryBase(): string {
  return ((import.meta.env.VITE_MICRO_APP_ASSET_BASE as string | undefined) ?? '').trim().replace(/\/+$/, '');
}

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
 * 获取子应用配置。entry 依次尝试：单应用 env → 产物基址 → dev port。
 * 命名规范：VITE_<UPPER_SNAKE_NAME>_APP_ENTRY / VITE_MICRO_APP_ASSET_BASE
 */
export function getMicroAppConfig(name: string): MicroAppConfig {
  const defaults = MICRO_APP_DEFAULTS[name];
  if (!defaults) {
    throw new Error(`Unknown micro app: "${name}". Add it to MICRO_APP_DEFAULTS.`);
  }

  const envKey = `VITE_${name.toUpperCase().replace(/-/g, '_')}_APP_ENTRY`;
  const envEntry = (import.meta.env[envKey] as string | undefined) ?? '';
  const assetBase = getAssetEntryBase();

  const entry =
    envEntry.trim() ||
    (assetBase && `${assetBase}/${name}/index.html`) ||
    `${DEFAULT_DEV_ENTRY_BASE}${getDevEntryPort(name)}`;

  return { ...defaults, entry };
}
