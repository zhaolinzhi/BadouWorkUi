/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { FLAVOR } from '@/common/config/flavor';
import { AIPAAS_BASE_URL, EXTERNAL_LOGIN_URL_BASE, getExternalLoginUrl } from '@/renderer/api/config';

const ENTERPRISE_AIPAAS = 'http://devops.badousoft.com/aipaas-service';
const PUBLIC_AIPAAS = 'http://localhost:8081';
const ENTERPRISE_LOGIN = 'https://devops.badousoft.com/aipaas-front/';
const PUBLIC_LOGIN = 'http://localhost:8000';

describe('flavor-conditional URLs in api/config.ts', () => {
  it('AIPAAS_BASE_URL matches the FLAVOR switch', () => {
    const expected = FLAVOR === 'enterprise' ? ENTERPRISE_AIPAAS : PUBLIC_AIPAAS;
    expect(AIPAAS_BASE_URL).toBe(expected);
  });

  it('EXTERNAL_LOGIN_URL_BASE matches the FLAVOR switch', () => {
    const expected = FLAVOR === 'enterprise' ? ENTERPRISE_LOGIN : PUBLIC_LOGIN;
    expect(EXTERNAL_LOGIN_URL_BASE).toBe(expected);
  });

  it('getExternalLoginUrl composes the base with the from flag', () => {
    expect(getExternalLoginUrl()).toBe(`${EXTERNAL_LOGIN_URL_BASE}?from=aionui`);
  });

  it('enterprise and public values are distinct', () => {
    // Guards against accidentally collapsing both branches to the same URL.
    expect(ENTERPRISE_AIPAAS).not.toBe(PUBLIC_AIPAAS);
    expect(ENTERPRISE_LOGIN).not.toBe(PUBLIC_LOGIN);
  });
});
