import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CryptoJS from 'crypto-js';
import { BackendHttpError } from '@/common/adapter/httpBridge';

const listProvidersInvoke = vi.fn();
const createProviderInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      listProviders: { invoke: listProvidersInvoke },
      createProvider: { invoke: createProviderInvoke },
    },
  },
}));

vi.mock('@/renderer/api/config', () => ({
  AIPAAS_BASE_URL: 'http://aipaas.test',
}));

const { NEWAPI_PROVIDER_ID, NEWAPI_BASE_URL, NEWAPI_DEFAULT_MODEL } =
  await import('@/renderer/services/newapi/postLoginBootstrap.constants');

// 用 NUL-padded 模拟 aipaas 加密,保证 decryptNewapiKey 能解出原明文
const SECRET = 'izMNRXR9Cx96fTiE';
const KEY = CryptoJS.enc.Utf8.parse(SECRET);
const IV = CryptoJS.enc.Utf8.parse(SECRET);

function aipaasLikeEncrypt(plain: string): string {
  const data = Buffer.from(plain, 'utf-8');
  const block = 16;
  const target = data.length + (block - (data.length % block));
  const padded = Buffer.alloc(target, 0x00);
  padded.set(data, 0);
  const cipher = CryptoJS.AES.encrypt(CryptoJS.lib.WordArray.create(padded), KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
  });
  return CryptoJS.enc.Base64.stringify(cipher.ciphertext);
}

let runNewapiPostLogin: (typeof import('@/renderer/services/newapi/postLoginBootstrap'))['runNewapiPostLogin'];

beforeEach(async () => {
  vi.resetModules();
  listProvidersInvoke.mockReset();
  createProviderInvoke.mockReset();
  vi.unstubAllGlobals();
  const mod = await import('@/renderer/services/newapi/postLoginBootstrap');
  runNewapiPostLogin = mod.runNewapiPostLogin;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetchOnce(body: unknown, init?: { status?: number; ok?: boolean; empty?: boolean }) {
  const status = init?.status ?? 200;
  const ok = init?.ok ?? true;
  const empty = init?.empty ?? false;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: async () => (empty ? '' : JSON.stringify(body)),
    })
  );
}

describe('runNewapiPostLogin — happy path', () => {
  it('fetches maskForCurrent → decrypts → list empty → creates provider with deepseek-v4-flash', async () => {
    const plain = 'sk-zzz-1234567890abcdef';
    const enc = aipaasLikeEncrypt(plain);
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc } });
    listProvidersInvoke.mockResolvedValue([]);
    createProviderInvoke.mockResolvedValue({ id: NEWAPI_PROVIDER_ID });

    await runNewapiPostLogin('TOKEN');

    expect(createProviderInvoke).toHaveBeenCalledTimes(1);
    expect(createProviderInvoke).toHaveBeenCalledWith({
      id: NEWAPI_PROVIDER_ID,
      platform: 'new-api',
      name: 'NewAPI',
      base_url: NEWAPI_BASE_URL,
      api_key: plain,
      models: [NEWAPI_DEFAULT_MODEL],
      enabled: true,
      is_full_url: true,
    });
  });

  it('sends Token header and credentials: include on the aipaas fetch', async () => {
    const enc = aipaasLikeEncrypt('sk-abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ hasOk: true, message: 'ok', bean: { enc } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    listProvidersInvoke.mockResolvedValue([]);
    createProviderInvoke.mockResolvedValue({ id: NEWAPI_PROVIDER_ID });

    await runNewapiPostLogin('MY-TOKEN');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/project/newapi/newapikeyqueryaction/maskForCurrent');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Token).toBe('MY-TOKEN');
    expect(init.credentials).toBe('include');
  });
});

describe('runNewapiPostLogin — skip paths', () => {
  it('skips when enc is null (user not yet provisioned)', async () => {
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc: null } });
    await runNewapiPostLogin('T');
    expect(listProvidersInvoke).not.toHaveBeenCalled();
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });

  it('skips when hasOk is false', async () => {
    stubFetchOnce({ hasOk: false, message: '未登录', bean: null });
    await runNewapiPostLogin('T');
    expect(listProvidersInvoke).not.toHaveBeenCalled();
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });

  it('skips when fetch returns empty body (expired session)', async () => {
    stubFetchOnce({}, { empty: true });
    await runNewapiPostLogin('T');
    expect(listProvidersInvoke).not.toHaveBeenCalled();
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });

  it('skips when fetch returns non-2xx status', async () => {
    stubFetchOnce({}, { status: 500, ok: false });
    await runNewapiPostLogin('T');
    expect(listProvidersInvoke).not.toHaveBeenCalled();
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });

  it('skips when decryption returns null', async () => {
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc: '!!!not-base64!!!' } });
    await runNewapiPostLogin('T');
    expect(listProvidersInvoke).not.toHaveBeenCalled();
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });

  it('skips when an existing provider already has the same api_key (idempotency)', async () => {
    const plain = 'sk-dup-1234567890abcdef';
    const enc = aipaasLikeEncrypt(plain);
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc } });
    listProvidersInvoke.mockResolvedValue([
      { id: 'other', api_key: 'sk-other', platform: 'new-api', name: 'X', base_url: 'x', models: [] },
      {
        id: NEWAPI_PROVIDER_ID,
        api_key: plain,
        platform: 'new-api',
        name: 'NewAPI',
        base_url: NEWAPI_BASE_URL,
        models: [NEWAPI_DEFAULT_MODEL],
      },
    ]);

    await runNewapiPostLogin('T');

    expect(createProviderInvoke).not.toHaveBeenCalled();
  });
});

describe('runNewapiPostLogin — 409 / errors', () => {
  it('treats 409 from createProvider as success (idempotent fallback)', async () => {
    const plain = 'sk-conflict-1234567890';
    const enc = aipaasLikeEncrypt(plain);
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc } });
    listProvidersInvoke.mockResolvedValue([]); // list 没命中,撞 POST 409
    createProviderInvoke.mockRejectedValue(new BackendHttpError(409, 'id_conflict', 'duplicate id'));

    await expect(runNewapiPostLogin('T')).resolves.toBeUndefined();
  });

  it('logs warn but does not throw when fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runNewapiPostLogin('T')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs warn but does not throw when listProviders throws', async () => {
    const enc = aipaasLikeEncrypt('sk-net-1234');
    stubFetchOnce({ hasOk: true, message: 'ok', bean: { enc } });
    listProvidersInvoke.mockRejectedValue(new Error('list fail'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runNewapiPostLogin('T')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(createProviderInvoke).not.toHaveBeenCalled();
  });
});
