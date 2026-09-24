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

type ProviderLike = { api_key: string };

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

function hasSameKey(providers: ReadonlyArray<ProviderLike>, plainKey: string): boolean {
  return providers.some((p) => p.api_key === plainKey);
}

/**
 * 登录后自动建 NewAPI provider 的编排函数。
 *
 * 流程:fetch 密文 → 解密 → 与本地 provider 列表比对(同 key 跳过)→ 创建骨架。
 * 任意步骤失败一律 console.warn,不抛、不弹 UI。
 *
 * 该函数应当以 fire-and-forget 方式被调用(不 await)。
 */
export async function runNewapiPostLogin(token: string): Promise<void> {
  try {
    const enc = await fetchMaskForCurrent(token);
    if (!enc) return;

    const plainKey = decryptNewapiKey(enc);
    if (!plainKey) return;

    const providers = (await ipcBridge.mode.listProviders.invoke()) as ReadonlyArray<ProviderLike>;
    if (hasSameKey(providers, plainKey)) return;

    try {
      await ipcBridge.mode.createProvider.invoke({
        id: NEWAPI_PROVIDER_ID,
        platform: 'new-api',
        name: NEWAPI_PROVIDER_NAME,
        base_url: NEWAPI_BASE_URL,
        api_key: plainKey,
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
