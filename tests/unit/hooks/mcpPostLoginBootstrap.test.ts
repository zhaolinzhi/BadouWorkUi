import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listServersInvoke = vi.fn();
const batchImportServersInvoke = vi.fn();

vi.mock('@/common/adapter/ipcBridge', () => ({
  mcpService: {
    listServers: { invoke: listServersInvoke },
    batchImportServers: { invoke: batchImportServersInvoke },
  },
}));

const { ensureKnowledgeServerMcp } = await import('@/renderer/hooks/mcp/ensureDefaultMcpServers');

const KNOWLEDGE_SERVER_URL = 'https://devops.badousoft.com/mcp-client/mcp/knowledge-server/sse';

beforeEach(() => {
  listServersInvoke.mockReset();
  batchImportServersInvoke.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ensureKnowledgeServerMcp', () => {
  it('imports the knowledge-server SSE server when it does not exist', async () => {
    listServersInvoke.mockResolvedValue([]);
    batchImportServersInvoke.mockResolvedValue([]);

    await ensureKnowledgeServerMcp();

    expect(batchImportServersInvoke).toHaveBeenCalledTimes(1);
    expect(batchImportServersInvoke).toHaveBeenCalledWith({
      servers: [
        {
          name: 'knowledge-server',
          description: '知识库MCP服务',
          transport: { type: 'sse', url: KNOWLEDGE_SERVER_URL },
          original_json: JSON.stringify(
            {
              mcpServers: {
                'knowledge-server': {
                  url: KNOWLEDGE_SERVER_URL,
                  description: '知识库MCP服务',
                },
              },
            },
            null,
            2
          ),
          enabled: true,
          builtin: false,
        },
      ],
    });
  });

  it('skips import when a server with the same name exists (case/whitespace insensitive)', async () => {
    listServersInvoke.mockResolvedValue([{ id: '1', name: '  Knowledge-Server  ' }]);

    await ensureKnowledgeServerMcp();

    expect(batchImportServersInvoke).not.toHaveBeenCalled();
  });

  it('resolves and warns when listing servers fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listServersInvoke.mockRejectedValue(new Error('list boom'));

    await expect(ensureKnowledgeServerMcp()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[mcp-postlogin] ensure knowledge-server failed:', expect.any(Error));
  });

  it('resolves and warns when importing fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listServersInvoke.mockResolvedValue([]);
    batchImportServersInvoke.mockRejectedValue(new Error('import boom'));

    await expect(ensureKnowledgeServerMcp()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[mcp-postlogin] ensure knowledge-server failed:', expect.any(Error));
  });
});
