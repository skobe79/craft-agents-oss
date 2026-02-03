/**
 * Agent Factory
 *
 * Creates the appropriate AI agent based on configuration.
 * Supports two agents:
 * - ClaudeAgent (Anthropic) - Default, using @anthropic-ai/claude-agent-sdk
 * - CodexAgent (OpenAI) - Using app-server mode with JSON-RPC
 *
 * Both agents implement AgentBackend directly.
 *
 * LLM Connections:
 * - Backends can be created from LLM connection configs
 * - Connection type maps to provider (anthropic, openai, openai-compat)
 * - Connection provides auth type, base URL, and model defaults
 */

import type { AgentBackend, BackendConfig, AgentProvider } from './types.ts';
import { ClaudeAgent } from '../claude-agent.ts';
import { CodexAgent } from '../codex-agent.ts';
import {
  getLlmConnection,
  getDefaultLlmConnection,
  type LlmConnection,
  type LlmConnectionType,
} from '../../config/storage.ts';

/**
 * Detect provider from stored auth type.
 *
 * Maps authentication types to their corresponding providers:
 * - api_key, oauth_token → Anthropic (Claude)
 * - codex_oauth → OpenAI (Codex)
 *
 * @param authType - The stored authentication type
 * @returns The detected provider
 */
export function detectProvider(authType: string): AgentProvider {
  switch (authType) {
    // Anthropic authentication types
    case 'api_key':
    case 'oauth_token':
      return 'anthropic';

    // Codex authentication (ChatGPT Plus via app-server OAuth)
    case 'codex_oauth':
      return 'openai';

    // Default to Anthropic for unknown types
    default:
      return 'anthropic';
  }
}

/**
 * Create the appropriate backend based on configuration.
 *
 * @param config - Backend configuration including provider selection
 * @returns An initialized AgentBackend instance
 * @throws Error if the requested provider is not yet implemented
 *
 * @example
 * ```typescript
 * // Create Anthropic (Claude) backend
 * const backend = createBackend({
 *   provider: 'anthropic',
 *   workspace: myWorkspace,
 *   model: 'claude-sonnet-4-5-20250929',
 * });
 *
 * // Create Codex backend (uses app-server mode)
 * const codexBackend = createBackend({
 *   provider: 'openai',
 *   workspace: myWorkspace,
 * });
 * ```
 */
export function createBackend(config: BackendConfig): AgentBackend {
  switch (config.provider) {
    case 'anthropic':
      // ClaudeAgent implements AgentBackend directly
      return new ClaudeAgent(config);

    case 'openai':
      // CodexAgent implements AgentBackend directly
      // Auth is handled by the app-server (ChatGPT Plus OAuth or ~/.codex/auth.json)
      return new CodexAgent(config);

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Create the appropriate agent based on configuration.
 * Alias for createBackend - prefer this name for new code.
 */
export const createAgent = createBackend;

/**
 * Get list of currently available providers.
 *
 * @returns Array of provider identifiers that have working implementations
 */
export function getAvailableProviders(): AgentProvider[] {
  return ['anthropic', 'openai'];
}

/**
 * Check if a provider is available for use.
 *
 * @param provider - Provider to check
 * @returns true if the provider has a working implementation
 */
export function isProviderAvailable(provider: AgentProvider): boolean {
  return getAvailableProviders().includes(provider);
}

// ============================================================
// LLM Connection Support
// ============================================================

/**
 * Map LLM connection type to agent provider.
 *
 * @param connectionType - The LLM connection type
 * @returns The corresponding agent provider
 */
export function connectionTypeToProvider(connectionType: LlmConnectionType): AgentProvider {
  switch (connectionType) {
    case 'anthropic':
      return 'anthropic';
    case 'openai':
    case 'openai-compat':
      return 'openai';
    default:
      return 'anthropic';
  }
}

/**
 * Map LLM auth type to backend auth type.
 *
 * @param authType - The LLM connection auth type
 * @returns The corresponding backend auth type
 */
export function connectionAuthTypeToBackendAuthType(
  authType: 'api_key' | 'oauth' | 'codex_oauth' | 'none'
): 'api_key' | 'oauth_token' | 'codex_oauth' | undefined {
  switch (authType) {
    case 'api_key':
      return 'api_key';
    case 'oauth':
      return 'oauth_token';
    case 'codex_oauth':
      return 'codex_oauth';
    case 'none':
      return undefined;
  }
}

/**
 * Get LLM connection for a session.
 * Resolution order: session.llmConnection > workspace.defaults.defaultLlmConnection > global default
 *
 * @param sessionConnection - Connection slug from session (may be undefined)
 * @param workspaceDefaultConnection - Workspace default connection (may be undefined)
 * @returns The resolved LLM connection or null if not found
 */
export function resolveSessionConnection(
  sessionConnection?: string,
  workspaceDefaultConnection?: string
): LlmConnection | null {
  // 1. Session-level connection (locked after first message)
  if (sessionConnection) {
    const connection = getLlmConnection(sessionConnection);
    if (connection) return connection;
  }

  // 2. Workspace default
  if (workspaceDefaultConnection) {
    const connection = getLlmConnection(workspaceDefaultConnection);
    if (connection) return connection;
  }

  // 3. Global default
  const defaultSlug = getDefaultLlmConnection();
  return getLlmConnection(defaultSlug);
}

/**
 * Create backend configuration from an LLM connection.
 *
 * @param connection - The LLM connection config
 * @param baseConfig - Base backend config (workspace, session, etc.)
 * @returns Complete BackendConfig ready for createBackend()
 */
export function createConfigFromConnection(
  connection: LlmConnection,
  baseConfig: Omit<BackendConfig, 'provider' | 'authType'>
): BackendConfig {
  return {
    ...baseConfig,
    provider: connectionTypeToProvider(connection.type),
    authType: connectionAuthTypeToBackendAuthType(connection.authType),
    // Use connection's default model if no model specified in baseConfig
    model: baseConfig.model || connection.defaultModel,
  };
}

/**
 * Create backend from an LLM connection slug.
 *
 * @param connectionSlug - The LLM connection slug
 * @param baseConfig - Base backend config (workspace, session, etc.)
 * @returns An initialized AgentBackend instance
 * @throws Error if connection not found
 */
export function createBackendFromConnection(
  connectionSlug: string,
  baseConfig: Omit<BackendConfig, 'provider' | 'authType'>
): AgentBackend {
  const connection = getLlmConnection(connectionSlug);
  if (!connection) {
    throw new Error(`LLM connection not found: ${connectionSlug}`);
  }

  const config = createConfigFromConnection(connection, baseConfig);
  return createBackend(config);
}
