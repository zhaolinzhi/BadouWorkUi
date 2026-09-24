import { AIPAAS_BASE_URL } from '@/renderer/api/config';
import { BackendHttpError, isBackendHttpError } from '@/common/adapter/httpBridge';
import { ipcBridge } from '@/common';
import { decryptNewapiKey } from '@/renderer/utils/crypto';
import {
  NEWAPI_BASE_URL,
  NEWAPI_DEFAULT_MODEL,
  NEWAPI_MASK_FOR_CURRENT_PATH,
  NEWAPI_PROVIDER_ID,
  NEWAPI_PROVIDER_NAME,
} from './postLoginBootstrap.constants';

type MaskForCurrentResponse = {
  hasOk: boolean;
  message: string;
  bean?: { enc: string | null } | null;
};

type ProviderLike = { id?: string; api_key: string };

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
 * 登录后自动建 NewAPI provider 的编排函数。
 *
 * 流程:fetch 密文 → 解密 → 补 `sk-` 前缀 → 查找本地 id='newapi-default' 的 provider:
 *   - 找到 + api_key 相同 → 跳过
 *   - 找到 + api_key 不同 → updateProvider(仅更新 api_key,其它字段不动)
 *   - 没找到 → createProvider
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
      if (existing.api_key === apiKey) return;
      // key 不一样 → 用新 key 更新(只改 api_key,其它字段不动)
      await ipcBridge.mode.updateProvider.invoke({
        id: NEWAPI_PROVIDER_ID,
        api_key: apiKey,
      });
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
        is_full_url: true,
      });
    } catch (e) {
      // 409 = 同 id 已存在(并发/竞态),按成功处理
      if (isBackendHttpError(e) && (e as BackendHttpError).status === 409) return;
      throw e;
    }
  } catch (e) {
    console.warn('[newapi-postlogin] failed:', e);
  }
}
