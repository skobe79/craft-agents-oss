export interface ToolStatusInfo {
  message: string;
}

const BUILTIN_TOOL_STATUS: Record<string, ToolStatusInfo> = {
  web_search: { message: 'Searching the web' },
  web_fetch: { message: 'Fetching URL' },
  code_execution: { message: 'Running Python' },
  update_user_preferences: { message: 'Updating preferences' },
};

/**
 * Get a user-friendly status message for a tool
 */
export function getToolStatusMessage(toolName: string): string {
  // Check built-in tools first
  const builtin = BUILTIN_TOOL_STATUS[toolName];
  if (builtin) {
    return `${builtin.message}...`;
  }

  // Handle MCP tools (mcp__server__toolname or similar patterns)
  if (toolName.includes('__')) {
    const parts = toolName.split('__');
    const actualToolName = parts[parts.length - 1] || toolName;
    const formattedName = formatToolName(actualToolName);
    return `Calling ${formattedName}...`;
  }

  // Default fallback
  const formattedName = formatToolName(toolName);
  return `Calling ${formattedName}...`;
}

/**
 * Format a tool name to be more human-readable
 */
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
