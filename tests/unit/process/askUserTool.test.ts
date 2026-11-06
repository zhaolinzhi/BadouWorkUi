/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  ASK_USER_SERVER_NAME,
  ASK_USER_TOOL_NAME,
  findAskUserServer,
  isAskUserToolName,
  resolveAskUserServerToAttach,
} from '@/common/chat/askUserTool';
import {
  ASK_USER_TOOL_DESCRIPTION,
  ASK_USER_TOOL_RESULT_TEXT,
  buildAskUserToolResult,
} from '@process/resources/builtinMcp/askUserTool';

describe('ask_user tool identifiers', () => {
  it('exposes a stable tool and server name', () => {
    expect(ASK_USER_TOOL_NAME).toBe('ask_user');
    expect(ASK_USER_SERVER_NAME).toBe('badouwork-ask-user');
  });
});

describe('isAskUserToolName', () => {
  it('matches the bare tool name', () => {
    expect(isAskUserToolName('ask_user')).toBe(true);
  });

  it('matches the MCP namespaced form used by aionrs', () => {
    expect(isAskUserToolName('mcp__badouwork-ask-user__ask_user')).toBe(true);
  });

  it('matches the server-prefixed form without the mcp__ prefix', () => {
    expect(isAskUserToolName('badouwork-ask-user__ask_user')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isAskUserToolName('  ask_user  ')).toBe(true);
  });

  it('does not match unrelated tools', () => {
    expect(isAskUserToolName('aionui_image_generation')).toBe(false);
    expect(isAskUserToolName('mcp__aionui-browser__navigate_page')).toBe(false);
    expect(isAskUserToolName('ExecCommand')).toBe(false);
    expect(isAskUserToolName('ask_user_extra')).toBe(false);
  });

  it('does not match empty or missing names', () => {
    expect(isAskUserToolName('')).toBe(false);
    expect(isAskUserToolName('   ')).toBe(false);
    expect(isAskUserToolName(undefined)).toBe(false);
    expect(isAskUserToolName(null)).toBe(false);
  });
});

describe('buildAskUserToolResult', () => {
  it('returns a single text content block', () => {
    const result = buildAskUserToolResult();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });

  it('tells the agent to end its turn and wait for the answer', () => {
    const result = buildAskUserToolResult();
    const text = result.content[0].text;
    expect(text).toBe(ASK_USER_TOOL_RESULT_TEXT);
    expect(text).toMatch(/end your turn/i);
    expect(text).toMatch(/wait for the user/i);
  });

  it('does not block — the result carries no pending state', () => {
    const result = buildAskUserToolResult();
    expect(result).not.toHaveProperty('isError');
  });
});

describe('ask_user tool description', () => {
  it('tells the model to call it before implementing dependent work', () => {
    expect(ASK_USER_TOOL_DESCRIPTION).toMatch(/BEFORE implementing/i);
  });

  it('tells the model to stop the turn after calling', () => {
    expect(ASK_USER_TOOL_DESCRIPTION).toMatch(/end your turn/i);
  });

  it('constrains the number of options per question', () => {
    expect(ASK_USER_TOOL_DESCRIPTION).toMatch(/2-4 concrete options/i);
  });
});

describe('findAskUserServer', () => {
  const askServer = { id: 'mcp-ask', name: 'badouwork-ask-user', builtin: true };

  it('finds the ask-user server by name', () => {
    const servers = [{ id: 'mcp-user', name: 'User MCP', builtin: false }, askServer];
    expect(findAskUserServer(servers)).toBe(askServer);
  });

  it('matches the name case-insensitively and ignores surrounding whitespace', () => {
    const servers = [{ id: 'x', name: '  BadouWork-Ask-User  ' }];
    expect(findAskUserServer(servers)?.id).toBe('x');
  });

  it('returns undefined when the server is not registered', () => {
    expect(findAskUserServer([{ id: 'a', name: 'Other MCP' }])).toBeUndefined();
  });

  it('returns undefined for an empty or missing catalog', () => {
    expect(findAskUserServer([])).toBeUndefined();
    expect(findAskUserServer(undefined)).toBeUndefined();
    expect(findAskUserServer(null)).toBeUndefined();
  });
});

describe('resolveAskUserServerToAttach', () => {
  const askServer = { id: 'mcp-ask', name: 'badouwork-ask-user', builtin: true };

  it('returns the server when it is registered but not selected', () => {
    const servers = [askServer, { id: 'mcp-user', name: 'User MCP' }];
    expect(resolveAskUserServerToAttach(servers, ['mcp-user'])?.id).toBe('mcp-ask');
  });

  it('returns undefined when it is already selected', () => {
    expect(resolveAskUserServerToAttach([askServer], ['mcp-ask'])).toBeUndefined();
  });

  it('returns undefined when nothing is selected but the server is registered', () => {
    // No selection at all still needs the server attached.
    expect(resolveAskUserServerToAttach([askServer], [])?.id).toBe('mcp-ask');
    expect(resolveAskUserServerToAttach([askServer], undefined)?.id).toBe('mcp-ask');
  });

  it('returns undefined when the server is not registered', () => {
    expect(resolveAskUserServerToAttach([{ id: 'a', name: 'Other' }], [])).toBeUndefined();
    expect(resolveAskUserServerToAttach([], [])).toBeUndefined();
  });
});
