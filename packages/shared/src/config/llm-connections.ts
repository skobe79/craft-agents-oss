/**
 * LLM Connections
 *
 * Named provider configurations that users can add, configure, and switch between.
 * Each session locks to a specific connection after the first message.
 * Workspaces can set a default connection.
 */

// Import models from centralized registry
import { ANTHROPIC_MODELS, OPENAI_MODELS, type ModelDefinition } from './models.ts';

// ============================================================
// Types
// ============================================================

/**
 * Connection type determines which backend implementation to use.
 * - 'anthropic': Native Anthropic API (Claude models)
 * - 'openai': Native OpenAI API (Codex via app-server OAuth)
 * - 'openai-compat': OpenAI-compatible API (Ollama, OpenRouter, etc.)
 */
export type LlmConnectionType = 'anthropic' | 'openai' | 'openai-compat';

/**
 * Authentication type for the connection.
 * - 'api_key': API key stored in credentials
 * - 'oauth': OAuth token (Claude Max)
 * - 'codex_oauth': ChatGPT Plus OAuth via Codex app-server
 * - 'none': No authentication required (local models like Ollama)
 */
export type LlmAuthType = 'api_key' | 'oauth' | 'codex_oauth' | 'none';

/**
 * LLM Connection configuration.
 * Stored in config.llmConnections array.
 */
export interface LlmConnection {
  /** URL-safe identifier (e.g., 'anthropic-api', 'ollama-local') */
  slug: string;

  /** Display name shown in UI (e.g., 'Anthropic (API Key)', 'Ollama') */
  name: string;

  /** Connection type determines backend implementation */
  type: LlmConnectionType;

  /** Custom base URL (required for openai-compat, optional override for others) */
  baseUrl?: string;

  /** Authentication type */
  authType: LlmAuthType;

  /** Override available models (for custom endpoints that don't support model listing) */
  models?: ModelDefinition[];

  /** Default model for this connection */
  defaultModel?: string;

  /**
   * Path to the Codex binary (for 'openai' type connections).
   * If not set, defaults to 'codex' in PATH.
   *
   * For Craft Agents fork with PreToolUse support, download from:
   * https://github.com/lukilabs/craft-agents-codex/releases
   */
  codexPath?: string;

  /** Timestamp when connection was created */
  createdAt: number;

  /** Timestamp when connection was last used */
  lastUsedAt?: number;
}

/**
 * LLM Connection with authentication status.
 * Used by UI to show which connections are ready to use.
 */
export interface LlmConnectionWithStatus extends LlmConnection {
  /** Whether the connection has valid credentials */
  isAuthenticated: boolean;

  /** Error message if authentication check failed */
  authError?: string;

  /** Whether this is the global default connection */
  isDefault?: boolean;
}

// ============================================================
// Built-in Connections
// ============================================================

/**
 * Default connections created on first run.
 * Users can delete any connection as long as at least one remains.
 */
export const BUILT_IN_CONNECTIONS: LlmConnection[] = [
  {
    slug: 'anthropic-api',
    name: 'Anthropic (API Key)',
    type: 'anthropic',
    authType: 'api_key',
    models: ANTHROPIC_MODELS,
    createdAt: 0,
  },
  {
    slug: 'claude-max',
    name: 'Claude Max',
    type: 'anthropic',
    authType: 'oauth',
    models: ANTHROPIC_MODELS,
    createdAt: 0,
  },
  {
    slug: 'codex',
    name: 'Codex (ChatGPT Plus)',
    type: 'openai',
    authType: 'codex_oauth',
    models: OPENAI_MODELS,
    createdAt: 0,
  },
];

/**
 * Default connection slug for new installations.
 */
export const DEFAULT_LLM_CONNECTION = 'anthropic-api';

// ============================================================
// Helpers
// ============================================================

/**
 * Generate a URL-safe slug from a display name.
 * @param name - Display name to convert
 * @returns URL-safe slug
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Check if a slug is valid (URL-safe, non-empty).
 * @param slug - Slug to validate
 * @returns true if valid
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug);
}

/**
 * Get credential key for an LLM connection.
 * Format: llm::{slug}::{credentialType}
 *
 * @param slug - Connection slug
 * @param credentialType - Type of credential ('api_key' or 'oauth_token')
 * @returns Credential key string
 */
export function getLlmCredentialKey(slug: string, credentialType: 'api_key' | 'oauth_token'): string {
  return `llm::${slug}::${credentialType}`;
}

/**
 * Map LlmAuthType to credential type.
 * @param authType - LLM auth type
 * @returns Credential type or null if no credential needed
 */
export function authTypeToCredentialType(authType: LlmAuthType): 'api_key' | 'oauth_token' | null {
  switch (authType) {
    case 'api_key':
      return 'api_key';
    case 'oauth':
    case 'codex_oauth':
      return 'oauth_token';
    case 'none':
      return null;
  }
}
