/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useSyncExternalStore } from 'react';
import type { KbChatStreamErrorCode } from '@/common/adapter/ipcBridge';

export type KbInlineAnswerStatus = 'streaming' | 'done' | 'aborted' | 'error';

export type KbInlineAnswerSource = {
  kbId: string;
  name: string;
  isShared: boolean;
};

export type KbInlineAnswerError = {
  code: KbChatStreamErrorCode | 'no_token' | 'send_failed';
  message: string;
};

export type KbInlineAnswerState = {
  source: KbInlineAnswerSource;
  status: KbInlineAnswerStatus;
  content: string;
  requestId: string;
  error?: KbInlineAnswerError;
};

export type KbInlineAnswerController = {
  start: (source: KbInlineAnswerSource, requestId: string) => void;
  appendChunk: (content: string) => void;
  finish: (reason: 'done' | 'aborted' | 'error', error?: KbInlineAnswerError) => void;
  clear: () => void;
};

type Listener = () => void;

const byConversation = new Map<string, KbInlineAnswerState>();
const listeners = new Map<string, Set<Listener>>();

const emit = (conversationId: string): void => {
  const set = listeners.get(conversationId);
  if (!set) return;
  for (const l of set) l();
};

const getSnapshot = (conversationId: string): KbInlineAnswerState | null => byConversation.get(conversationId) ?? null;

const subscribe = (conversationId: string, listener: Listener): (() => void) => {
  let set = listeners.get(conversationId);
  if (!set) {
    set = new Set();
    listeners.set(conversationId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
};

/**
 * Subscribe a React component to the conversation's inline KB answer state.
 * Returns a controller with imperative methods. Methods are no-ops when no
 * state exists yet; calling `start()` seeds the state and triggers a re-render
 * for this component and any other subscribers.
 */
export const useKbInlineAnswer = (conversationId: string): KbInlineAnswerController => {
  // Subscribe so subsequent start/appendChunk/finish/clear notify this hook.
  useSyncExternalStore(
    (listener) => subscribe(conversationId, listener),
    () => getSnapshot(conversationId),
    (): KbInlineAnswerState | null => null
  );

  return {
    start: (source, requestId) => {
      byConversation.set(conversationId, {
        source,
        status: 'streaming',
        content: '',
        requestId,
      });
      emit(conversationId);
    },
    appendChunk: (content) => {
      const prev = byConversation.get(conversationId);
      if (!prev || prev.status !== 'streaming') return;
      byConversation.set(conversationId, { ...prev, content: prev.content + content });
      emit(conversationId);
    },
    finish: (reason, error) => {
      const prev = byConversation.get(conversationId);
      if (!prev) return;
      byConversation.set(conversationId, {
        ...prev,
        status: reason,
        error,
      });
      emit(conversationId);
    },
    clear: () => {
      byConversation.delete(conversationId);
      emit(conversationId);
    },
  };
};

/** Public subscribe API for non-React consumers (e.g. plain tests, event emitters). */
export const subscribeKbInlineAnswer = (conversationId: string, listener: Listener): (() => void) =>
  subscribe(conversationId, listener);

/** Public snapshot API for non-React consumers. */
export const getKbInlineAnswerSnapshot = (conversationId: string): KbInlineAnswerState | null =>
  getSnapshot(conversationId);

/** Public clear API — drops any in-flight or final answer for the conversation. */
export const clearKbInlineAnswer = (conversationId: string): void => {
  byConversation.delete(conversationId);
  emit(conversationId);
};

/** Test-only reset. Production code never calls this. */
export const _resetKbInlineAnswerStoreForTest = (): void => {
  byConversation.clear();
  listeners.clear();
};
