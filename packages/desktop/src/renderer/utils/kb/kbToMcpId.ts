const KB_MCP_ID_PREFIX = 'kb-';
const ID_BOUNDARY_RE = /\s/;

const checkId = (raw: string): string | null => {
  if (!raw || ID_BOUNDARY_RE.test(raw)) return null;
  return raw;
};

export const kbIdToMcpServerId = (kbId: string): string | null => {
  const checked = checkId(kbId);
  if (!checked) return null;
  return checked.startsWith(KB_MCP_ID_PREFIX) ? checked : `${KB_MCP_ID_PREFIX}${checked}`;
};

export const mcpServerIdToKbId = (serverId: string): string | null => {
  const checked = checkId(serverId);
  if (!checked) return null;
  if (!checked.startsWith(KB_MCP_ID_PREFIX)) return null;
  return checked.slice(KB_MCP_ID_PREFIX.length);
};
