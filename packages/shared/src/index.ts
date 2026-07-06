/**
 * @arch-agentz/shared
 *
 * Shared business logic for Craft Agent.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { CraftAgent } from '@arch-agentz/shared/agent';
 *   import { loadStoredConfig } from '@arch-agentz/shared/config';
 *   import { getCredentialManager } from '@arch-agentz/shared/credentials';
 *   import { CraftMcpClient } from '@arch-agentz/shared/mcp';
 *   import { debug } from '@arch-agentz/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@arch-agentz/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@arch-agentz/shared/workspaces';
 *
 * Available modules:
 *   - agent: CraftAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Craft API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
