/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetKbInlineAnswerStoreForTest,
  getKbInlineAnswerSnapshot,
  useKbInlineAnswer,
} from '@/renderer/utils/kb/kbInlineAnswerStore';
import type { KbInlineAnswerController } from '@/renderer/utils/kb/kbInlineAnswerStore';

const Capture = ({ conversationId }: { conversationId: string }) => {
  const ctrl = useKbInlineAnswer(conversationId);
  const bag = (globalThis as Record<string, unknown>).__ctrls as Map<string, KbInlineAnswerController> | undefined;
  if (bag) bag.set(conversationId, ctrl);
  return null;
};

const getCtrls = (): Map<string, KbInlineAnswerController> => {
  const existing = (globalThis as Record<string, unknown>).__ctrls as Map<string, KbInlineAnswerController> | undefined;
  if (existing) return existing;
  const fresh = new Map<string, KbInlineAnswerController>();
  (globalThis as Record<string, unknown>).__ctrls = fresh;
  return fresh;
};

describe('kbInlineAnswerStore', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__ctrls = new Map<string, KbInlineAnswerController>();
  });

  afterEach(() => {
    _resetKbInlineAnswerStoreForTest();
    (globalThis as Record<string, unknown>).__ctrls = new Map<string, KbInlineAnswerController>();
  });

  it('returns null state when nothing has happened', () => {
    const { unmount } = render(<Capture conversationId='c1' />);
    expect(getKbInlineAnswerSnapshot('c1')).toBeNull();
    unmount();
  });

  it('starts streaming with the given source', () => {
    const { unmount } = render(<Capture conversationId='c1' />);
    const ctrl = getCtrls().get('c1');
    if (!ctrl) throw new Error('expected controller for c1');
    act(() => {
      ctrl.start({ kbId: '42', name: 'Docs', isShared: false }, 'req-1');
    });
    expect(getKbInlineAnswerSnapshot('c1')).toMatchObject({
      status: 'streaming',
      source: { kbId: '42', name: 'Docs', isShared: false },
      content: '',
    });
    unmount();
  });

  it('appends chunks and marks done', () => {
    const { unmount } = render(<Capture conversationId='c1' />);
    const ctrl = getCtrls().get('c1');
    if (!ctrl) throw new Error('expected controller for c1');
    act(() => {
      ctrl.start({ kbId: '42', name: 'Docs', isShared: false }, 'req-1');
      ctrl.appendChunk('hello ');
      ctrl.appendChunk('world');
      ctrl.finish('done');
    });
    expect(getKbInlineAnswerSnapshot('c1')).toMatchObject({
      status: 'done',
      content: 'hello world',
    });
    unmount();
  });

  it('records errors without dropping partial content', () => {
    const { unmount } = render(<Capture conversationId='c1' />);
    const ctrl = getCtrls().get('c1');
    if (!ctrl) throw new Error('expected controller for c1');
    act(() => {
      ctrl.start({ kbId: '42', name: 'Docs', isShared: false }, 'req-1');
      ctrl.appendChunk('partial');
      ctrl.finish('error', { code: 'network', message: 'fail' });
    });
    expect(getKbInlineAnswerSnapshot('c1')).toMatchObject({
      status: 'error',
      content: 'partial',
      error: { code: 'network', message: 'fail' },
    });
    unmount();
  });

  it('isolates state by conversation id', () => {
    const { unmount: u1 } = render(<Capture conversationId='c1' />);
    const { unmount: u2 } = render(<Capture conversationId='c2' />);
    const ctrl1 = getCtrls().get('c1');
    if (!ctrl1) throw new Error('expected controller for c1');
    act(() => {
      ctrl1.start({ kbId: '1', name: 'A', isShared: false }, 'r1');
    });
    expect(getKbInlineAnswerSnapshot('c1')).toMatchObject({ status: 'streaming' });
    expect(getKbInlineAnswerSnapshot('c2')).toBeNull();
    u1();
    u2();
  });

  it('clears state', () => {
    const { unmount } = render(<Capture conversationId='c1' />);
    const ctrl = getCtrls().get('c1');
    if (!ctrl) throw new Error('expected controller for c1');
    act(() => {
      ctrl.start({ kbId: '42', name: 'Docs', isShared: false }, 'req-1');
      ctrl.clear();
    });
    expect(getKbInlineAnswerSnapshot('c1')).toBeNull();
    unmount();
  });
});
