/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { PROTOCOL_SCHEME, parseDeepLinkUrl } from '@/process/utils/deepLink';

describe('parseDeepLinkUrl', () => {
  it('parses the auth callback URL that AIPaaS redirects to after SSO', () => {
    const parsed = parseDeepLinkUrl(`${PROTOCOL_SCHEME}://auth/callback?token=tok-1&userId=u1&username=alice`);

    expect(parsed?.action).toBe('auth/callback');
    expect(parsed?.params).toEqual({ token: 'tok-1', userId: 'u1', username: 'alice' });
  });

  it('rejects a URL whose scheme is not the registered one', () => {
    // Guards the silent-failure mode: the OS hands the app a URL, and a
    // scheme mismatch makes parseDeepLinkUrl return null with no error.
    expect(parseDeepLinkUrl('aionui://auth/callback?token=tok-1')).toBeNull();
  });

  it('rejects a malformed URL instead of throwing', () => {
    expect(parseDeepLinkUrl('not a url')).toBeNull();
  });

  it('parses the nested provider/add form and decodes the base64 data param', () => {
    const data = Buffer.from(JSON.stringify({ base_url: 'https://example.test', api_key: 'sk-1' })).toString('base64');
    const parsed = parseDeepLinkUrl(`${PROTOCOL_SCHEME}://provider/add?v=1&data=${data}`);

    expect(parsed?.action).toBe('provider/add');
    expect(parsed?.params.v).toBe('1');
    expect(parsed?.params.base_url).toBe('https://example.test');
    expect(parsed?.params.api_key).toBe('sk-1');
    // The raw data param is consumed, not passed through.
    expect(parsed?.params.data).toBeUndefined();
  });

  it('uses the badouwork scheme that electron-builder registers', () => {
    // electron-builder.yml declares `schemes: [badouwork]`. If the runtime
    // scheme drifts from that, the OS routes the callback but the parser
    // discards it and login never completes.
    expect(PROTOCOL_SCHEME).toBe('badouwork');
  });
});
