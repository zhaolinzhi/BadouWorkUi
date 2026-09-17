/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { addEventListener } from '@/renderer/utils/emitter';
import { mark, perfTimeAsync } from '@/renderer/utils/perf';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

/**
 * Whitelist of message types that indicate content generation is in progress.
 * Only these types should trigger the sidebar loading spinner.
 * Using a whitelist (instead of a blacklist) prevents unknown/internal message
 * types (e.g. slash_commands_updated, acp_context_usage) from falsely
 * triggering the generating state.
 */
const isGeneratingStreamMessage = (type: string): boolean => {
  return (
    type === 'content' ||
    type === 'start' ||
    type === 'thought' ||
    type === 'thinking' ||
    type === 'tool_group' ||
    type === 'acp_tool_call' ||
    type === 'acp_permission' ||
    type === 'permission' ||
    type === 'plan'
  );
};

const isTerminalAgentStatus = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const { status } = data as { status?: string };
  return status === 'error' || status === 'disconnected';
};

const isTerminalStreamMessage = (message: { type: string; data: unknown }): boolean => {
  return (
    message.type === 'finish' ||
    message.type === 'error' ||
    (message.type === 'agent_status' && isTerminalAgentStatus(message.data))
  );
};

const isTerminalTurnState = (state: string): boolean => {
  return state === 'ai_waiting_input' || state === 'error' || state === 'stopped';
};

export type SidebarStreamGuardDecision = {
  markGenerating: boolean;
  clearCompleted: boolean;
  lateIgnored: boolean;
};

export const getSidebarStreamGuardDecision = ({
  type,
  completed,
  completedTurnId,
  streamTurnId,
}: {
  type: string;
  completed: boolean;
  /** Turn whose completion set the `completed` flag, when known. */
  completedTurnId?: string | null;
  /** Turn the incoming stream frame belongs to, when known. */
  streamTurnId?: string | null;
}): SidebarStreamGuardDecision => {
  if (!isGeneratingStreamMessage(type)) {
    return {
      markGenerating: false,
      clearCompleted: false,
      lateIgnored: false,
    };
  }

  if (type === 'start') {
    return {
      markGenerating: true,
      clearCompleted: true,
      lateIgnored: false,
    };
  }

  if (completed) {
    // A frame from a DIFFERENT turn than the one that completed is not late —
    // it belongs to a newer turn. codex keeps streaming after ending its
    // prompt turn (unified exec runs the command in a background PTY), so the
    // old turn's completion used to swallow the next turn's whole stream and
    // the sidebar never lit up as generating.
    const isNewerTurn =
      typeof streamTurnId === 'string' &&
      streamTurnId.length > 0 &&
      typeof completedTurnId === 'string' &&
      completedTurnId.length > 0 &&
      streamTurnId !== completedTurnId;
    if (!isNewerTurn) {
      return {
        markGenerating: false,
        clearCompleted: false,
        lateIgnored: true,
      };
    }
    return {
      markGenerating: true,
      clearCompleted: true,
      lateIgnored: false,
    };
  }

  return {
    markGenerating: true,
    clearCompleted: false,
    lateIgnored: false,
  };
};

type ConversationListSyncSnapshot = {
  conversations: TChatConversation[];
  generatingConversationIds: Set<string>;
  completionUnreadConversationIds: Set<string>;
};

const listeners = new Set<() => void>();

let isStoreInitialized = false;
let conversationsState: TChatConversation[] = [];
let generatingConversationIdsState = new Set<string>();
let completionUnreadConversationIdsState = new Set<string>();
let completedConversationIdsState = new Set<string>();
let conversation_idsState = new Set<string>();
// Full id → owning project_id map over ALL loaded conversations (incl. the team
// member rows filtered out of `conversationsState`). Every row from
// GET /api/conversations carries project_id, so this lets the route publish the
// active project synchronously on switch — no waiting for the per-conversation
// `conversation.get` to resolve (that async lag painted the previous project's
// tree). `null` = known conversation with no project (or project_id not yet
// backfilled); a missing key = not loaded yet (caller placeholders).
let projectIdByIdState = new Map<string, string | null>();
let activeConversationIdState: string | null = null;
let snapshotState: ConversationListSyncSnapshot = {
  conversations: conversationsState,
  generatingConversationIds: generatingConversationIdsState,
  completionUnreadConversationIds: completionUnreadConversationIdsState,
};

const emitStoreChange = () => {
  snapshotState = {
    conversations: conversationsState,
    generatingConversationIds: generatingConversationIdsState,
    completionUnreadConversationIds: completionUnreadConversationIdsState,
  };
  listeners.forEach((listener) => listener());
};

const subscribeConversationListSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getConversationListSyncSnapshot = (): ConversationListSyncSnapshot => snapshotState;

/**
 * Synchronous lookup of a conversation's owning project id from the in-memory
 * list snapshot (loaded once via GET /api/conversations, every row carrying
 * project_id). Returns the project id string, `null` when the conversation is
 * known but has no project (or its project_id has not been backfilled yet), or
 * `undefined` when the conversation is not in the snapshot yet (brand-new /
 * not-loaded — the caller should placeholder rather than paint a stale project).
 */
export const getSnapshotConversationProjectId = (conversation_id: string): string | null | undefined => {
  if (!projectIdByIdState.has(conversation_id)) return undefined;
  return projectIdByIdState.get(conversation_id) ?? null;
};

/** Test hook: seed the id → project_id map so the sync lookup can be exercised. */
export const setConversationProjectMapForTest = (entries: Array<[string, string | null]>): void => {
  projectIdByIdState = new Map(entries);
};

/**
 * In-flight deduplication for `refreshConversations`.
 *
 * 16+ emitters across the app fire `chat.history.refresh` and three backend
 * listeners (`listChanged`, `responseStream`, `turnCompleted`) also call into
 * us. Profiler data (2026-09-10) showed a single user action producing two
 * HTTP round-trips 4ms apart — the second was almost always redundant.
 *
 * Two guards:
 *  1. While a fetch is in flight, every concurrent caller awaits the same
 *     promise instead of issuing a second request.
 *  2. After a successful (or failed) fetch, calls within `COOLDOWN_MS` are
 *     skipped — the previous response is already the freshest snapshot the
 *     store will hold. Cooldown is reset by any explicit `force: true`
 *     call (currently unused — kept as the escape hatch for future callers
 *     that genuinely need a re-fetch, e.g. after a confirmed mutation).
 */
const COOLDOWN_MS = 100;
let inflightRefresh: Promise<void> | null = null;
let lastRefreshFinishedAt = 0;

/**
 * Stable-function trick for `isConversationGenerating` / `hasCompletionUnread`.
 *
 * Both depend on module-level Sets that are replaced wholesale on every store
 * change. A naive `useCallback(fn, [set])` gives a new reference every time,
 * defeating `ConversationRow`'s `React.memo` and forcing every row to re-render
 * on any unrelated store mutation (the worst offender was `chat.history.refresh`
 * which fires on every send — 16+ emitter sites across the app). Hoisting
 * them to module-level functions that read the latest Set on each call makes
 * their reference identity stable forever, so the row memo can short-circuit.
 */
const isConversationGeneratingFn = (conversation_id: string): boolean =>
  generatingConversationIdsState.has(conversation_id);

const hasCompletionUnreadFn = (conversation_id: string): boolean =>
  completionUnreadConversationIdsState.has(conversation_id);

const doRefresh = (): Promise<void> =>
  perfTimeAsync({ tag: 'perf.chatHistory', message: 'refresh_fetch' }, () =>
    ipcBridge.database.getUserConversations.invoke({ limit: 10000 })
  )
    .then((result) => {
      const items = result?.items;
      mark('perf.chatHistory.refresh', 'refresh_fetched', { count: Array.isArray(items) ? items.length : 0 });
      if (items && Array.isArray(items)) {
        const filteredData = items.filter((conv) => {
          // Legacy rows from the pre-provider-probe health check flow are hidden
          // from normal history. New health checks must not create conversations.
          const extra = conv.extra as { is_health_check?: boolean; team_id?: string; teamId?: string } | undefined;
          return extra?.is_health_check !== true && !extra?.team_id && !extra?.teamId;
        });
        conversationsState = filteredData;
        // Use ALL conversation IDs (including team/legacy health-check rows) so the
        // responseStream listener recognises them as known and doesn't
        // trigger an infinite refreshConversations loop.
        conversation_idsState = new Set(items.map((conversation) => conversation.id));
        // Map ALL rows (unfiltered) so a team member conversation's project_id is
        // resolvable too — the team route looks up its leader conversation here.
        projectIdByIdState = new Map(items.map((conversation) => [conversation.id, conversation.project_id ?? null]));
        emitStoreChange();
        return;
      }

      conversationsState = [];
      conversation_idsState = new Set();
      projectIdByIdState = new Map();
      emitStoreChange();
    })
    .catch((error) => {
      console.error('[WorkspaceGroupedHistory] Failed to load conversations:', error);
      conversationsState = [];
      conversation_idsState = new Set();
      projectIdByIdState = new Map();
      emitStoreChange();
    })
    .finally(() => {
      inflightRefresh = null;
      lastRefreshFinishedAt = Date.now();
    });

const refreshConversations = (options: { force?: boolean } = {}) => {
  // In-flight: every concurrent caller awaits the same promise. This collapses
  // bursts like `emit('chat.history.refresh')` + `listChanged` within a few ms
  // into one HTTP request — verified by perf data on 2026-09-10.
  if (inflightRefresh) {
    void inflightRefresh;
    return;
  }

  // Cooldown: a refresh that just finished is still the freshest snapshot the
  // store will see; a second request 4ms later returns effectively the same
  // payload. Forced refreshes bypass this (escape hatch).
  if (!options.force && Date.now() - lastRefreshFinishedAt < COOLDOWN_MS) {
    mark('perf.chatHistory.refresh', 'refresh_cooldown_skip');
    return;
  }

  inflightRefresh = doRefresh();
};

const markGenerating = (conversation_id: string) => {
  if (generatingConversationIdsState.has(conversation_id)) {
    return;
  }

  generatingConversationIdsState = new Set(generatingConversationIdsState).add(conversation_id);
  emitStoreChange();
};

const clearGenerating = (conversation_id: string) => {
  if (!generatingConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(generatingConversationIdsState);
  next.delete(conversation_id);
  generatingConversationIdsState = next;
  emitStoreChange();
};

const markCompletionUnread = (conversation_id: string) => {
  if (completionUnreadConversationIdsState.has(conversation_id)) {
    return;
  }

  completionUnreadConversationIdsState = new Set(completionUnreadConversationIdsState).add(conversation_id);
  emitStoreChange();
};

const clearCompletionUnreadState = (conversation_id: string) => {
  if (!completionUnreadConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(completionUnreadConversationIdsState);
  next.delete(conversation_id);
  completionUnreadConversationIdsState = next;
  emitStoreChange();
};

/** Turn id that put a conversation into the `completed` set (for turn-aware
 *  late-frame detection). */
const completedTurnIdByConversation = new Map<string, string | null>();

const markCompleted = (conversation_id: string, turn_id?: string | null) => {
  completedConversationIdsState = new Set(completedConversationIdsState).add(conversation_id);
  completedTurnIdByConversation.set(conversation_id, turn_id ?? null);
};

const clearCompleted = (conversation_id: string) => {
  if (!completedConversationIdsState.has(conversation_id)) {
    return;
  }

  const next = new Set(completedConversationIdsState);
  next.delete(conversation_id);
  completedConversationIdsState = next;
  completedTurnIdByConversation.delete(conversation_id);
};

const logLateStreamIgnored = (conversation_id: string, type: string) => {
  void ipcBridge.application.writeRendererLog
    .invoke({
      level: 'warn',
      tag: 'conversationRuntimeView',
      message: 'late_stream_ignored_for_runtime',
      data: {
        conversation_id,
        stream_type: type,
      },
    })
    .catch(() => {});
};

const setActiveConversationState = (conversation_id: string | null) => {
  activeConversationIdState = conversation_id;
};

const initializeConversationListSyncStore = () => {
  if (isStoreInitialized) {
    return;
  }

  isStoreInitialized = true;
  refreshConversations();

  // Single funnel for every `chat.history.refresh` emitter (~20 sites across
  // the app). Tagging here means callers stay untouched yet every refresh is
  // traceable end-to-end against the `refresh_fetch` span that follows.
  addEventListener('chat.history.refresh', () => {
    mark('perf.chatHistory.refresh', 'refresh_triggered');
    refreshConversations();
  });
  ipcBridge.conversation.listChanged.on((event) => {
    if (event.action === 'deleted') {
      clearGenerating(event.conversation_id);
      clearCompletionUnreadState(event.conversation_id);
      clearCompleted(event.conversation_id);
    }
    refreshConversations();
  });
  ipcBridge.conversation.responseStream.on((message) => {
    const conversation_id = message.conversation_id;
    if (!conversation_id) {
      return;
    }

    if (!conversation_idsState.has(conversation_id)) {
      refreshConversations();
    }

    if (isTerminalStreamMessage(message)) {
      const wasGenerating = generatingConversationIdsState.has(conversation_id);
      if (wasGenerating && activeConversationIdState !== conversation_id) {
        markCompletionUnread(conversation_id);
      }
      clearGenerating(conversation_id);
      return;
    }

    const decision = getSidebarStreamGuardDecision({
      type: message.type,
      completed: completedConversationIdsState.has(conversation_id),
      completedTurnId: completedTurnIdByConversation.get(conversation_id) ?? null,
      streamTurnId: message.turn_id ?? null,
    });
    if (decision.clearCompleted) {
      clearCompleted(conversation_id);
    }
    if (decision.lateIgnored) {
      logLateStreamIgnored(conversation_id, message.type);
      return;
    }
    if (decision.markGenerating) {
      markGenerating(conversation_id);
    }
  });
  ipcBridge.conversation.turnCompleted.on((event) => {
    if (isTerminalTurnState(event.state) && activeConversationIdState !== event.session_id) {
      markCompletionUnread(event.session_id);
    }
    markCompleted(event.session_id, event.turn_id);
    clearGenerating(event.session_id);
    refreshConversations();
  });
};

export const useConversationListSync = () => {
  useEffect(() => {
    initializeConversationListSyncStore();
  }, []);

  const { conversations, generatingConversationIds, completionUnreadConversationIds } = useSyncExternalStore(
    subscribeConversationListSync,
    getConversationListSyncSnapshot,
    getConversationListSyncSnapshot
  );

  const clearCompletionUnread = useCallback((conversation_id: string) => {
    clearCompletionUnreadState(conversation_id);
  }, []);

  const setActiveConversation = useCallback((conversation_id: string | null) => {
    setActiveConversationState(conversation_id);
  }, []);

  // Stable-function trick: instead of `useCallback(fn, [Set])` (which gives a
  // new reference every time the store replaces the Set), keep one module-level
  // function that reads the latest Set on every call. The reference is the
  // same forever, so `ConversationRow`'s `React.memo` actually short-circuits
  // when only unrelated store state changes (e.g. `chat.history.refresh`).
  const isConversationGenerating = isConversationGeneratingFn;
  const hasCompletionUnread = hasCompletionUnreadFn;

  // Stable return shape — a new object literal each render would defeat the
  // `useMemo` in `ConversationHistoryContext` and re-render every history
  // consumer on any store change.
  return useMemo(
    () => ({
      conversations,
      isConversationGenerating,
      hasCompletionUnread,
      clearCompletionUnread,
      setActiveConversation,
    }),
    [conversations, clearCompletionUnread, setActiveConversation]
  );
};
