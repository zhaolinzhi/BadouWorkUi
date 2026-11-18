/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildAtFileInsertion, buildAtMentionInsertion, resolveAtFileMenuKey } from '@/renderer/utils/chat/atFileQuery';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

describe('buildAtFileInsertion', () => {
  it('uses relative path when available', () => {
    const item: FileOrFolderItem = {
      name: 'main.ts',
      path: '/workspace/src/main.ts',
      relativePath: 'src/main.ts',
      isFile: true,
    };

    expect(buildAtFileInsertion(item)).toBe('@src/main.ts');
  });

  it('escapes boundary characters in inserted paths', () => {
    const item: FileOrFolderItem = {
      name: 'my file.ts',
      path: '/workspace/my file.ts',
      relativePath: 'my file.ts',
      isFile: true,
    };

    expect(buildAtFileInsertion(item)).toBe('@my\\ file.ts');
  });

  it('returns null when no path is available', () => {
    const item = {
      name: 'broken.ts',
      isFile: true,
    } as FileOrFolderItem;

    expect(buildAtFileInsertion(item)).toBeNull();
  });
});

describe('buildAtFileInsertion — KB items', () => {
  it('produces @kb:<name> for KB-kind items (renderer-visible form)', () => {
    const item: FileOrFolderItem = {
      name: 'Remote KB',
      path: 'kb:abc-123',
      isFile: false,
      kind: 'kb',
    };

    expect(buildAtFileInsertion(item)).toBe('@kb:Remote KB');
  });

  it('falls back to legacy @kb:<id> when KB-kind item has no name', () => {
    // Safety net for callers that synthesise KB items without a name field;
    // send path still resolves the id and routes through MCP.
    const item: FileOrFolderItem = {
      name: '',
      path: 'kb:abc-123',
      isFile: false,
      kind: 'kb',
    };

    expect(buildAtFileInsertion(item)).toBe('@kb:abc-123');
  });

  it('returns null when KB-kind item has neither name nor path', () => {
    const item: FileOrFolderItem = {
      name: '',
      path: '',
      isFile: false,
      kind: 'kb',
    };

    expect(buildAtFileInsertion(item)).toBeNull();
  });
});

describe('buildAtMentionInsertion — KB trailing space', () => {
  const kbItem: FileOrFolderItem = {
    name: 'Remote KB',
    path: 'kb:abc-123',
    isFile: false,
    kind: 'kb',
  };

  it('appends a space after a KB mention so the user can keep typing', () => {
    expect(buildAtMentionInsertion(kbItem)).toBe('@kb:Remote KB ');
  });

  it('does not add a second space when the following text already starts with whitespace', () => {
    expect(buildAtMentionInsertion(kbItem, ' next')).toBe('@kb:Remote KB');
  });

  it('appends a space to the legacy id form as well', () => {
    const legacyItem: FileOrFolderItem = {
      name: '',
      path: 'kb:abc-123',
      isFile: false,
      kind: 'kb',
    };
    expect(buildAtMentionInsertion(legacyItem)).toBe('@kb:abc-123 ');
  });

  it('keeps file mentions unchanged', () => {
    const fileItem: FileOrFolderItem = {
      name: 'main.ts',
      path: '/workspace/src/main.ts',
      relativePath: 'src/main.ts',
      isFile: true,
    };
    expect(buildAtMentionInsertion(fileItem)).toBe('@src/main.ts');
  });

  it('returns null when the item has no insertable identity', () => {
    expect(buildAtMentionInsertion({ name: '', path: '', isFile: false, kind: 'kb' } as FileOrFolderItem)).toBeNull();
  });
});

describe('resolveAtFileMenuKey', () => {
  it('accepts on Enter and Tab', () => {
    expect(resolveAtFileMenuKey('Enter', true)).toBe('accept');
    expect(resolveAtFileMenuKey('Tab', true)).toBe('accept');
  });

  it('navigates on ArrowUp / ArrowDown', () => {
    expect(resolveAtFileMenuKey('ArrowUp', true)).toBe('up');
    expect(resolveAtFileMenuKey('ArrowDown', true)).toBe('down');
  });

  it('dismisses on Escape regardless of items', () => {
    expect(resolveAtFileMenuKey('Escape', true)).toBe('dismiss');
    expect(resolveAtFileMenuKey('Escape', false)).toBe('dismiss');
  });

  it('does not handle other keys', () => {
    expect(resolveAtFileMenuKey('a', true)).toBeNull();
    expect(resolveAtFileMenuKey(' ', true)).toBeNull();
  });

  it('with no items, only Escape resolves (accept/nav are null so keys are not hijacked)', () => {
    expect(resolveAtFileMenuKey('Enter', false)).toBeNull();
    expect(resolveAtFileMenuKey('Tab', false)).toBeNull();
    expect(resolveAtFileMenuKey('ArrowDown', false)).toBeNull();
  });
});
