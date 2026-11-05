/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared identifiers for the `ask_user` MCP tool.
 *
 * The tool is served by the built-in `badouwork-ask-user` MCP server. Agents
 * that talk MCP namespace their tool calls, so the same tool surfaces under
 * different names depending on the runtime:
 *
 * - aionrs  → `mcp__badouwork-ask-user__ask_user`
 * - other agents → `ask_user` (bare) or `badouwork-ask-user__ask_user`
 *
 * Both the main process (which registers the MCP server) and the renderer
 * (which turns the tool call into an interactive question card) need to agree
 * on these names, so they live in `common/`.
 */

/** MCP tool name exposed by the built-in ask-user server. */
export const ASK_USER_TOOL_NAME = 'ask_user';

/** Name of the built-in MCP server that exposes {@link ASK_USER_TOOL_NAME}. */
export const ASK_USER_SERVER_NAME = 'badouwork-ask-user';

/**
 * Previous name of the built-in ask-user MCP server.
 *
 * The server was renamed to match the product name. The old row is removed on
 * startup so the renamed server registers cleanly instead of leaving a stale
 * duplicate behind.
 */
export const ASK_USER_SERVER_LEGACY_NAMES = ['aionui-ask-user'] as const;

/**
 * Detect whether a tool call name refers to the ask-user tool.
 *
 * Matches the bare tool name and every MCP-namespaced variant
 * (`mcp__<server>__ask_user`, `<server>__ask_user`). Matching on the last
 * `__` segment keeps this independent of the server naming scheme.
 *
 * @param name - Raw tool name as reported by the agent runtime.
 * @returns True when the name identifies the ask-user tool.
 */
export function isAskUserToolName(name: string | undefined | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed === ASK_USER_TOOL_NAME) return true;
  // MCP namespacing: `mcp__<server>__<tool>` / `<server>__<tool>`.
  if (trimmed.includes('__')) {
    const last = trimmed.split('__').pop() || '';
    if (last === ASK_USER_TOOL_NAME) return true;
  }
  return false;
}

/**
 * The MCP server shapes the conversation-creation path deals with.
 *
 * `builtin` servers are excluded by the backend's repo-backed resolver
 * (`mcp_resolve.rs`: `if !selected || row.builtin { continue; }`), so they can
 * only reach a session through the inline `selected_session_mcp_servers`
 * snapshot — which carries the full transport, not just an id.
 */
export type McpServerLike = {
  id: string;
  name: string;
  builtin?: boolean;
};

/**
 * Find the ask-user MCP server among the available servers.
 *
 * Matched by NAME, not id: server ids are generated per install and differ
 * between machines, while the name is the stable contract.
 *
 * @param servers - The MCP servers available to the conversation.
 * @returns The ask-user server, or `undefined` when it is not registered.
 */
export function findAskUserServer<T extends McpServerLike>(servers: readonly T[] | undefined | null): T | undefined {
  if (!servers?.length) return undefined;
  const target = ASK_USER_SERVER_NAME.toLowerCase();
  return servers.find((server) => server.name?.trim().toLowerCase() === target);
}

/**
 * Decide whether the ask-user server must be force-attached to a session.
 *
 * The backend loads only the MCP servers a conversation explicitly selects —
 * it never pulls in every enabled server — so an assistant pinned to a set
 * that predates the ask-user server would never expose the tool. Because the
 * ask-user server is builtin, the only way it can be attached is the inline
 * session snapshot the renderer builds at conversation-creation time.
 *
 * The server is force-attached when it is registered but the current selection
 * does not already include it. It is never *removed* from a selection the user
 * made explicitly — a user who unchecks it keeps it unchecked.
 *
 * @param servers - Every MCP server available to the conversation.
 * @param selectedIds - Ids of the servers currently selected.
 * @returns The ask-user server when it needs force-attaching, else undefined.
 */
export function resolveAskUserServerToAttach<T extends McpServerLike>(
  servers: readonly T[] | undefined | null,
  selectedIds: readonly string[] | undefined | null
): T | undefined {
  const server = findAskUserServer(servers);
  if (!server) return undefined;
  if (selectedIds?.includes(server.id)) return undefined;
  return server;
}
