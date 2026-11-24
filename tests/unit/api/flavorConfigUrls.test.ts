/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FLAVOR } from '@/common/config/flavor';
import {
  AIPAAS_BASE_URL,
  EXTERNAL_LOGIN_FLAG,
  EXTERNAL_LOGIN_URL_BASE,
  getExternalLoginUrl,
} from '@/renderer/api/config';
import { PROTOCOL_SCHEME } from '@/process/utils/deepLink';

const ENTERPRISE_AIPAAS = 'https://devops.badousoft.com/aipaas-service';
const PUBLIC_AIPAAS = 'https://devops.badousoft.com/aipublic-platform';
const ENTERPRISE_LOGIN = 'https://devops.badousoft.com/aipaas-front/';
const PUBLIC_LOGIN = 'https://devops.badousoft.com/aipaas-public/';

describe('flavor-conditional URLs in api/config.ts', () => {
  it('AIPAAS_BASE_URL matches the FLAVOR switch', () => {
    const expected = FLAVOR === 'enterprise' ? ENTERPRISE_AIPAAS : PUBLIC_AIPAAS;
    expect(AIPAAS_BASE_URL).toBe(expected);
  });

  it('EXTERNAL_LOGIN_URL_BASE matches the FLAVOR switch', () => {
    const expected = FLAVOR === 'enterprise' ? ENTERPRISE_LOGIN : PUBLIC_LOGIN;
    expect(EXTERNAL_LOGIN_URL_BASE).toBe(expected);
  });

  it('EXTERNAL_LOGIN_FLAG identifies the app to AIPaaS by the registered scheme', () => {
    // The `from` value doubles as the deep-link scheme AIPaaS redirects to.
    // AIPaaS resolves it through a hardcoded allowlist
    // ({aionui, badouwork, ...}) and redirects to `<from>://auth/callback`.
    // If it names a scheme AIPaaS does not know, the callback silently never
    // fires and the desktop app sits on the login page.
    //
    // Asserting against PROTOCOL_SCHEME rather than a literal keeps the
    // contract intact across branded builds that rename the scheme.
    expect(EXTERNAL_LOGIN_FLAG).toBe(`from=${PROTOCOL_SCHEME}`);
  });

  it('the scheme named by the from flag is the one electron-builder registers', () => {
    // The chain has three links: AIPaaS builds `<from>://auth/callback`, the
    // OS routes that scheme to the app, and the app parses it. Each link is
    // keyed on the scheme name, so all three must agree.
    const ymlPath = path.resolve(__dirname, '../../../packages/desktop/electron-builder.yml');
    const yml = fs.readFileSync(ymlPath, 'utf8');
    const match = yml.match(/^\s*schemes:\s*\n\s*-\s*(\S+)\s*$/m);
    expect(match?.[1]).toBe(PROTOCOL_SCHEME);
    expect(EXTERNAL_LOGIN_FLAG).toBe(`from=${match?.[1]}`);
  });

  it('the Linux desktop entry registers the same scheme', () => {
    // The .deb desktop entry declares the scheme handler MIME type. If it
    // names a different scheme than the app registers, the Linux build
    // installs without a handler for its own deep link and the login
    // callback is never delivered.
    const ymlPath = path.resolve(__dirname, '../../../packages/desktop/electron-builder.yml');
    const yml = fs.readFileSync(ymlPath, 'utf8');
    const mime = yml.match(/^\s*MimeType:\s*x-scheme-handler\/(\S+);/m);
    expect(mime?.[1]).toBe(PROTOCOL_SCHEME);
  });

  it('getExternalLoginUrl composes the base with the from flag', () => {
    expect(getExternalLoginUrl()).toBe(`${EXTERNAL_LOGIN_URL_BASE}?${EXTERNAL_LOGIN_FLAG}`);
  });

  it('enterprise and public values are distinct', () => {
    // Guards against accidentally collapsing both branches to the same URL.
    expect(ENTERPRISE_AIPAAS).not.toBe(PUBLIC_AIPAAS);
    expect(ENTERPRISE_LOGIN).not.toBe(PUBLIC_LOGIN);
  });
});
