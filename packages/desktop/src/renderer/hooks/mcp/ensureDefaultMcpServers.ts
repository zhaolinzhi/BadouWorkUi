import { mcpService } from '@/common/adapter/ipcBridge';
import type { IMcpServer } from '@/common/config/storage';

const KNOWLEDGE_SERVER_NAME = 'knowledge-server';
const KNOWLEDGE_SERVER_URL = 'https://devops.badousoft.com/mcp-client/mcp/knowledge-server/sse';
const KNOWLEDGE_SERVER_DESCRIPTION = '知识库MCP服务';

type ImportServerPayload = Partial<IMcpServer> & Pick<IMcpServer, 'name' | 'transport'>;

const buildKnowledgeServerPayload = (): ImportServerPayload => ({
  name: KNOWLEDGE_SERVER_NAME,
  description: KNOWLEDGE_SERVER_DESCRIPTION,
  transport: {
    type: 'sse',
    url: KNOWLEDGE_SERVER_URL,
  },
  original_json: JSON.stringify(
    {
      mcpServers: {
        [KNOWLEDGE_SERVER_NAME]: {
          url: KNOWLEDGE_SERVER_URL,
          description: KNOWLEDGE_SERVER_DESCRIPTION,
        },
      },
    },
    null,
    2
  ),
  enabled: true,
  builtin: false,
});

/**
 * Adds the default knowledge-base MCP server when it is missing.
 *
 * Called after a successful login as a fire-and-forget task: failures are
 * logged and never block the login flow. An existing server with the same
 * name (trimmed, case-insensitive) is left untouched, including its enabled
 * state and URL.
 */
export async function ensureKnowledgeServerMcp(): Promise<void> {
  try {
    const servers = (await mcpService.listServers.invoke()) || [];
    const exists = servers.some((server) => server.name.trim().toLowerCase() === KNOWLEDGE_SERVER_NAME);
    if (exists) return;

    await mcpService.batchImportServers.invoke({ servers: [buildKnowledgeServerPayload()] });
    console.info('[mcp-postlogin] knowledge-server MCP added');
  } catch (error) {
    console.warn('[mcp-postlogin] ensure knowledge-server failed:', error);
  }
}
