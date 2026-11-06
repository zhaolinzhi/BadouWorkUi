/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Built-in MCP server that lets an agent ask the user a question and wait.
 *
 * Runs as a standalone stdio process spawned by the MCP client (aioncore).
 * The tool itself is stateless: the questions travel in the tool call
 * arguments and are rendered as an interactive card by the chat UI. The
 * user's answer comes back as the next user message.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ASK_USER_SERVER_NAME, ASK_USER_TOOL_NAME } from '@/common/chat/askUserTool';
import { ASK_USER_SCHEMA, ASK_USER_TOOL_DESCRIPTION, buildAskUserToolResult } from './askUserTool';

async function main() {
  const server = new McpServer({
    name: ASK_USER_SERVER_NAME,
    version: '1.0.0',
  });

  server.tool(ASK_USER_TOOL_NAME, ASK_USER_TOOL_DESCRIPTION, ASK_USER_SCHEMA, async () => buildAskUserToolResult());

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[AskUserMCP] Fatal error:', error);
  process.exit(1);
});
