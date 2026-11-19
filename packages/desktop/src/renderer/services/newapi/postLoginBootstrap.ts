import { AIPAAS_BASE_URL } from '@/renderer/api/config';
import type { BackendHttpError } from '@/common/adapter/httpBridge';
import { isBackendHttpError } from '@/common/adapter/httpBridge';
import { ipcBridge } from '@/common';
import type { ModelSettings } from '@/common/config/storage';
import { decryptNewapiKey } from '@/renderer/utils/crypto';
import { PROVIDERS_SWR_KEY } from '@/renderer/hooks/agent/useModelProviderList';
import { mutate } from 'swr';
import {
  NEWAPI_BASE_URL,
  NEWAPI_DEFAULT_MODEL,
  NEWAPI_DEFAULT_MODEL_SETTINGS,
  NEWAPI_MASK_FOR_CURRENT_PATH,
  NEWAPI_PROVIDER_ID,
  NEWAPI_PROVIDER_NAME,
} from './postLoginBootstrap.constants';

type MaskForCurrentResponse = {
  hasOk: boolean;
  message: string;
  bean?: { enc: string | null } | null;
};

type ProviderLike = { id?: string; api_key: string; model_settings?: Record<string, ModelSettings> };

/**
 * GET /project/newapi/newapikeyqueryaction/maskForCurrent — 取当前登录用户的 NewAPI Key AES 密文。
 * 鉴权走 AIPAAS cookie(session)+ 显式 Token 头(与 useKnowledgeBaseList 同款)。
 *
 * 返回密文;若用户未开通 / 未登录 / 接口报错 / 响应为空,返回 null(由调用方静默处理)。
 * fetch 自身抛错(网络异常)会让错误冒到外层 catch,触发 console.warn — 与 spec §4 一致。
 */
async function fetchMaskForCurrent(token: string): Promise<string | null> {
  const resp = await fetch(`${AIPAAS_BASE_URL}${NEWAPI_MASK_FOR_CURRENT_PATH}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Token: token, Accept: 'application/json' },
  });
  if (!resp.ok) return null;
  const text = await resp.text();
  if (!text.trim()) return null;
  try {
    const json = JSON.parse(text) as MaskForCurrentResponse;
    if (!json.hasOk) return null;
    return json.bean?.enc ?? null;
  } catch {
    return null;
  }
}

/**
 * 给 NewAPI key 补 `sk-` 前缀(若已存在则不重复加)。
 * 之所以补前缀:NewAPI 兼容 OpenAI,`Authorization: Bearer sk-xxx` 协议要求 `sk-` 前缀。
 * aipaas 后端解密出来的明文可能不带这个前缀,这里补齐再保存。
 */
function ensureSkPrefix(rawKey: string): string {
  return rawKey.startsWith('sk-') ? rawKey : `sk-${rawKey}`;
}

/**
 * 让 provider 列表的 SWR 缓存重新拉取。
 *
 * provider 列表的 SWR 配置关闭了自动刷新(`revalidateOnFocus: false`,
 * 见 `PROVIDERS_SWR_OPTIONS`),只有显式 `mutate()` 才会重新拉取。
 * 设置页里的增删改都会调它,但登录后自动建 provider 这条路径以前没有调 ——
 * 于是 provider 明明建好了,界面却一直看不到(用户表现为"登录后没有添加默认token")。
 *
 * 失败无所谓:缓存失效只是让它下次读的时候重新拉,拉不动也不影响已落库的数据。
 */
async function invalidateProvidersCache(): Promise<void> {
  try {
    await mutate(PROVIDERS_SWR_KEY);
  } catch (e) {
    console.warn('[newapi-postlogin] provider cache invalidation failed:', e);
  }
}

/**
 * 登录后自动建 NewAPI provider 的编排函数。
 *
 * 流程:fetch 密文 → 解密 → 补 `sk-` 前缀 → 查找本地 id='newapi-default' 的 provider:
 *   - 找到 + api_key 相同 → 跳过
 *   - 找到 + api_key 不同 → updateProvider(仅更新 api_key,其它字段不动)
 *   - 没找到 → createProvider
 * 写入 provider 后必须让 provider 列表的 SWR 缓存失效,否则新建的 provider
 * 在界面上看不见(provider 列表关闭了自动刷新,只认显式 mutate)。
 * 任意步骤失败一律 console.warn,不抛、不弹 UI。
 *
 * 该函数应当以 fire-and-forget 方式被调用(不 await)。
 */
export async function runNewapiPostLogin(token: string): Promise<void> {
  try {
    const enc = await fetchMaskForCurrent(token);
    if (!enc) return;

    const rawKey = decryptNewapiKey(enc);
    if (!rawKey) return;

    const apiKey = ensureSkPrefix(rawKey);

    const providers = (await ipcBridge.mode.listProviders.invoke()) as ReadonlyArray<ProviderLike>;
    const existing = providers.find((p) => p.id === NEWAPI_PROVIDER_ID);

    if (existing) {
      // 已存在同名 provider;比对(已统一前缀的)api_key 是否一致。
      // 由于保存时统一经过 ensureSkPrefix,这里直接 === 比较即可。
      if (existing.api_key === apiKey) {
        // 同 key 命中: 检查 model_settings 是否缺 tool_wire_shape,缺则回填
        const currentSettings = existing.model_settings?.[NEWAPI_DEFAULT_MODEL];
        if (!currentSettings?.tool_wire_shape) {
          try {
            await ipcBridge.mode.updateProvider.invoke({
              id: NEWAPI_PROVIDER_ID,
              model_settings: { [NEWAPI_DEFAULT_MODEL]: NEWAPI_DEFAULT_MODEL_SETTINGS },
            });
            await invalidateProvidersCache();
          } catch (e) {
            // 回填失败不阻塞登录主流程
            console.warn('[newapi-postlogin] model_settings backfill failed:', e);
          }
        }
        return;
      }
      // key 不一样 → 用新 key 更新(只改 api_key,其它字段不动)
      await ipcBridge.mode.updateProvider.invoke({
        id: NEWAPI_PROVIDER_ID,
        api_key: apiKey,
      });
      await invalidateProvidersCache();
      return;
    }

    try {
      await ipcBridge.mode.createProvider.invoke({
        id: NEWAPI_PROVIDER_ID,
        platform: 'new-api',
        name: NEWAPI_PROVIDER_NAME,
        base_url: NEWAPI_BASE_URL,
        api_key: apiKey,
        models: [NEWAPI_DEFAULT_MODEL],
        enabled: true,
        is_full_url: false,
        model_settings: {
          [NEWAPI_DEFAULT_MODEL]: NEWAPI_DEFAULT_MODEL_SETTINGS,
        },
      });
      await invalidateProvidersCache();
    } catch (e) {
      // 409 = 同 id 已存在(并发/竞态),按成功处理
      if (isBackendHttpError(e) && (e as BackendHttpError).status === 409) return;
      throw e;
    }
  } catch (e) {
    console.warn('[newapi-postlogin] failed:', e);
  }
}
