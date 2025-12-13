/**
 * Dynamic API Tool Factory
 *
 * Creates a single flexible MCP tool per API configuration.
 * Each tool accepts { path, method, params } and auto-injects authentication.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ApiConfig } from './types.ts';
import { debug } from '../tui/utils/debug.ts';
import { SUMMARIZATION_MODEL } from '../config/models.ts';

/**
 * Credential for HTTP Basic Authentication
 */
export interface BasicAuthCredential {
  username: string;
  password: string;
}

/**
 * API credential - either a simple string (API key/token) or basic auth credentials
 */
export type ApiCredential = string | BasicAuthCredential;

/**
 * Type guard to check if credential is BasicAuthCredential
 */
function isBasicAuthCredential(cred: ApiCredential): cred is BasicAuthCredential {
  return typeof cred === 'object' && cred !== null && 'username' in cred && 'password' in cred;
}

// Token limit for summarization trigger (roughly ~40KB of text)
const TOKEN_LIMIT = 10000;

// Max tokens to send to Haiku for summarization (~80KB, well under 200k context)
const MAX_SUMMARIZATION_INPUT = 20000;

// Lazy-initialized Anthropic client for summarization
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

/**
 * Estimate token count from text length (rough approximation: 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Summarize a large API response to fit within context limits.
 * Uses Claude Haiku for fast, cheap summarization.
 */
async function summarizeLargeResponse(
  response: string,
  apiName: string,
  path: string,
  requestParams: Record<string, unknown> | undefined
): Promise<string> {
  const client = getAnthropicClient();

  // Build context from request params
  const paramsContext = requestParams
    ? `Request parameters: ${JSON.stringify(requestParams)}`
    : 'No specific parameters provided.';

  // Truncate response to fit within Haiku's context safely
  const maxChars = MAX_SUMMARIZATION_INPUT * 4; // ~80KB
  const truncatedResponse = response.length > maxChars
    ? response.substring(0, maxChars) + '\n\n[... truncated for summarization ...]'
    : response;
  const wasTruncated = response.length > maxChars;

  try {
    const result = await client.messages.create({
      model: SUMMARIZATION_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are summarizing an API response that was too large to fit in context.

API: ${apiName}
Endpoint: ${path}
${paramsContext}
${wasTruncated ? '\nNote: The response was truncated before summarization due to extreme size.' : ''}

Your task:
1. Extract the MOST RELEVANT information based on the request
2. Preserve key data points, IDs, URLs, and actionable information
3. Summarize long text content but keep essential details
4. Format the output cleanly for the AI assistant to use

API Response to summarize:
${truncatedResponse}

Provide a concise but comprehensive summary that captures the essential information.`
      }]
    });

    const textBlock = result.content.find(b => b.type === 'text');
    return textBlock?.text || 'Failed to summarize response';
  } catch (error) {
    debug(`[api-tools] Summarization failed: ${error}`);
    // Fall back to truncation if summarization fails
    return response.substring(0, 40000) + '\n\n[Response truncated due to size]';
  }
}

/**
 * Build headers for an API request, injecting authentication
 */
function buildHeaders(auth: ApiConfig['auth'], credential: ApiCredential): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // No auth needed for type='none' or missing auth
  if (!auth || auth.type === 'none') {
    return headers;
  }

  // Basic auth requires username:password credential
  if (auth.type === 'basic') {
    if (isBasicAuthCredential(credential)) {
      const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }
    return headers;
  }

  // Other types use string credential (API key/token)
  const apiKey = typeof credential === 'string' ? credential : '';
  if (!apiKey) {
    return headers;
  }

  if (auth.type === 'header') {
    headers[auth.headerName || 'x-api-key'] = apiKey;
  } else if (auth.type === 'bearer') {
    const scheme = auth.authScheme || 'Bearer';
    headers['Authorization'] = `${scheme} ${apiKey}`;
  }
  // Query type is handled in buildUrl

  return headers;
}

/**
 * Build the full URL for an API request
 */
function buildUrl(
  baseUrl: string,
  path: string,
  method: string,
  params: Record<string, unknown> | undefined,
  auth: ApiConfig['auth'],
  credential: ApiCredential
): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${baseUrl}${normalizedPath}`;

  // Handle query param auth (only for string credentials)
  const apiKey = typeof credential === 'string' ? credential : '';
  if (auth?.type === 'query' && auth.queryParam && apiKey) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}${auth.queryParam}=${encodeURIComponent(apiKey)}`;
  }

  // Handle GET params in query string
  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const urlParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        // Handle arrays and objects
        if (typeof value === 'object') {
          urlParams.append(key, JSON.stringify(value));
        } else {
          urlParams.append(key, String(value));
        }
      }
    }
    const queryString = urlParams.toString();
    if (queryString) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}${queryString}`;
    }
  }

  return url;
}

/**
 * Build tool description from API config
 */
function buildToolDescription(config: ApiConfig): string {
  let desc = `Make authenticated requests to ${config.name} API (${config.baseUrl})\n\n`;
  desc += `Authentication is handled automatically - just specify path, method, and params.\n\n`;

  // Check for old cache format (no documentation field)
  if (!config.documentation) {
    desc += `⚠️ This API was cached with an older format. Run "/agent refresh" to get full API documentation.\n\n`;
    desc += `Until then, you can still make requests but you'll need to figure out the endpoints yourself.`;
    return desc;
  }

  // Include the rich documentation extracted from the agent definition
  desc += config.documentation;

  if (config.docsUrl) {
    desc += `\n\nOfficial docs: ${config.docsUrl}`;
  }

  return desc;
}

/**
 * Create a single flexible MCP tool for an API configuration.
 * The tool accepts { path, method, params } and handles auth automatically.
 *
 * @param config - API configuration with documentation
 * @param credential - API credential (string for API key/token, BasicAuthCredential for basic auth, empty string for public APIs)
 * @returns SDK tool that can be included in an MCP server
 */
export function createApiTool(
  config: ApiConfig,
  credential: ApiCredential
) {
  const toolName = `api_${config.name}`;
  debug(`[api-tools] Creating flexible tool: ${toolName}`);

  const description = buildToolDescription(config);

  return tool(
    toolName,
    description,
    {
      path: z.string().describe('API endpoint path, e.g., "/search" or "/v1/completions"'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method - check documentation for correct method per endpoint'),
      params: z.record(z.string(), z.unknown()).optional().describe('Request body (POST/PUT/PATCH) or query parameters (GET)'),
    },
    async (args) => {
      const { path, method, params } = args;

      try {
        const url = buildUrl(config.baseUrl, path, method, params, config.auth, credential);
        const headers = buildHeaders(config.auth, credential);

        debug(`[api-tools] ${config.name}: ${method} ${url}`);

        const fetchOptions: RequestInit = {
          method,
          headers,
        };

        // Add body for non-GET requests
        if (method !== 'GET' && params && Object.keys(params).length > 0) {
          fetchOptions.body = JSON.stringify(params);
        }

        const response = await fetch(url, fetchOptions);
        const text = await response.text();

        // Check for error responses
        if (!response.ok) {
          debug(`[api-tools] ${config.name} error ${response.status}: ${text.substring(0, 200)}`);
          return {
            content: [{
              type: 'text' as const,
              text: `API Error ${response.status}: ${text}`,
            }],
            isError: true,
          };
        }

        debug(`[api-tools] ${config.name} success, response length: ${text.length}`);

        // Check if response is too large and needs summarization
        const estimatedTokens = estimateTokens(text);
        if (estimatedTokens > TOKEN_LIMIT) {
          debug(`[api-tools] Response too large (~${estimatedTokens} tokens), summarizing...`);
          const summary = await summarizeLargeResponse(text, config.name, path, params);
          return {
            content: [{
              type: 'text' as const,
              text: `[Response summarized - original was ~${estimatedTokens} tokens]\n\n${summary}`,
            }],
          };
        }

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        debug(`[api-tools] ${config.name} request failed: ${message}`);
        return {
          content: [{ type: 'text' as const, text: `Request failed: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

/**
 * Create an in-process MCP server with a single flexible API tool.
 *
 * @param config - API configuration
 * @param credential - API credential (string for API key/token, BasicAuthCredential for basic auth, empty string for public APIs)
 * @returns SDK MCP server that can be passed to query()
 */
export function createApiServer(
  config: ApiConfig,
  credential: ApiCredential
): ReturnType<typeof createSdkMcpServer> {
  debug(`[api-tools] Creating server for ${config.name}`);

  const apiTool = createApiTool(config, credential);

  return createSdkMcpServer({
    name: `api_${config.name}`,
    version: '1.0.0',
    tools: [apiTool],
  });
}
