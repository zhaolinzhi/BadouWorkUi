/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/renderer/hooks/context/AuthContext';
import { ipcBridge } from '@/common';
import type { KbChatStreamErrorCode } from '@/common/adapter/ipcBridge';
import {
  useKbInlineAnswer,
  type KbInlineAnswerController,
  type KbInlineAnswerError,
} from '@/renderer/utils/kb/kbInlineAnswerStore';

export type InlineKbStreamOptions = {
  conversationId: string;
};

export type KbMentionSource = {
  kbId: string;
  name: string;
  isShared: boolean;
};

export type InlineKbStreamResult = {
  status: 'idle' | 'streaming' | 'done' | 'aborted' | 'error';
  content: string;
  error?: KbInlineAnswerError;
  startSend: (question: string, kbId: string, source: KbMentionSource) => Promise<void>;
  abort: () => void;
};

const newRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `kb-inline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useInlineKbStream = ({ conversationId }: InlineKbStreamOptions): InlineKbStreamResult => {
  const { user, notifyTokenExpired } = useAuth();
  const controller = useKbInlineAnswer(conversationId);
  // Local state mirrors the store so the active caller gets synchronous
  // reads (without waiting for the next subscription tick). The store is
  // the canonical source for any other consumer (e.g. the overlay in Task 10).
  const [status, setStatus] = useState<InlineKbStreamResult['status']>('idle');
  const [content, setContent] = useState('');
  const [error, setError] = useState<KbInlineAnswerError | undefined>(undefined);
  const requestIdRef = useRef<string | null>(null);
  // Keep the latest controller accessible from the long-lived IPC listeners
  // without re-subscribing on every render (the controller object identity
  // changes each render, so depending on it directly would re-register
  // listeners). `notifyTokenExpired` is already memoized in AuthContext so it
  // can be referenced directly.
  const controllerRef = useRef<KbInlineAnswerController | null>(controller);
  controllerRef.current = controller;

  useEffect(() => {
    const offChunk = ipcBridge.kbChat.streamChunk.on((p: unknown) => {
      const payload = p as { requestId: string; content: string };
      if (payload.requestId !== requestIdRef.current) return;
      controllerRef.current?.appendChunk(payload.content);
      setContent((prev) => prev + payload.content);
    });
    const offError = ipcBridge.kbChat.streamError.on((p: unknown) => {
      const payload = p as { requestId: string; code: KbChatStreamErrorCode; message: string };
      if (payload.requestId !== requestIdRef.current) return;
      const err: KbInlineAnswerError = { code: payload.code, message: payload.message };
      setError(err);
      setStatus('error');
      controllerRef.current?.finish('error', err);
      if (payload.code === 'token_expired') notifyTokenExpired('kb-chat');
    });
    const offEnd = ipcBridge.kbChat.streamEnd.on((p: unknown) => {
      const payload = p as { requestId: string; reason: 'done' | 'aborted' | 'error' };
      if (payload.requestId !== requestIdRef.current) return;
      if (payload.reason === 'done') {
        setStatus('done');
        controllerRef.current?.finish('done');
      } else if (payload.reason === 'aborted') {
        setStatus('aborted');
        controllerRef.current?.finish('aborted');
      }
    });
    return () => {
      offChunk();
      offError();
      offEnd();
    };
  }, [notifyTokenExpired]);

  const startSend = useCallback(
    async (question: string, kbId: string, source: KbMentionSource) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const token = user?.token ?? null;
      if (!token) {
        const err: KbInlineAnswerError = { code: 'no_token', message: 'Please sign in first' };
        setError(err);
        setStatus('error');
        return;
      }
      const previous = requestIdRef.current;
      if (previous) void ipcBridge.kbChat.abort.invoke({ requestId: previous });

      const requestId = newRequestId();
      requestIdRef.current = requestId;
      setContent('');
      setError(undefined);
      setStatus('streaming');
      controller?.start(source, requestId);

      const result = await ipcBridge.kbChat.send.invoke({
        requestId,
        kbId,
        question: trimmed,
        threadId: conversationId,
        token,
      });
      if (result && !result.ok && requestIdRef.current === requestId) {
        const err: KbInlineAnswerError = {
          code: 'send_failed',
          message: (result as { message?: string }).message ?? 'send failed',
        };
        setError(err);
        setStatus('error');
        controller?.finish('error', err);
      }
    },
    [controller, conversationId, user?.token]
  );

  const abort = useCallback(() => {
    const requestId = requestIdRef.current;
    if (!requestId) return;
    void ipcBridge.kbChat.abort.invoke({ requestId });
  }, []);

  useEffect(
    () => () => {
      const requestId = requestIdRef.current;
      if (requestId) void ipcBridge.kbChat.abort.invoke({ requestId });
    },
    []
  );

  return { status, content, error, startSend, abort };
};
