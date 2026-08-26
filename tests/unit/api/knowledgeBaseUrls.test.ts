/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { getKnowledgeBaseCreateUrl, getKnowledgeBaseEditUrl, EXTERNAL_LOGIN_URL_BASE } from '@/renderer/api/config';

const base = EXTERNAL_LOGIN_URL_BASE.replace(/\/$/, '');

describe('getKnowledgeBaseCreateUrl / getKnowledgeBaseEditUrl', () => {
  it('create URL ends with /add and has no id segment', () => {
    const url = getKnowledgeBaseCreateUrl();
    expect(url.startsWith(`${base}/#/module/tree/edit/ai_knowledge_user/add?`)).toBe(true);
    expect(url).toContain('addFormData=');
    expect(url).toContain('backParams=');
    expect(url).toContain('currentTreeNodeData=');
  });

  it('edit URL embeds the id directly under ai_knowledge_user (no /add/ segment)', () => {
    const url = getKnowledgeBaseEditUrl('kb-1');
    expect(url.startsWith(`${base}/#/module/tree/edit/ai_knowledge_user/kb-1?`)).toBe(true);
    expect(url).not.toContain('/add/kb-1');
    expect(url).not.toMatch(/\/add\//);
    expect(url).toContain('addFormData=');
  });
});
