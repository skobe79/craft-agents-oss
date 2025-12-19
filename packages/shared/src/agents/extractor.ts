/**
 * Agentic agent definition extractor
 *
 * Uses Claude Agent SDK to agentically fetch and extract agent instructions
 * from Craft documents. Claude uses MCP tools to read the document and
 * intelligently extracts the relevant content.
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { getDefaultOptions } from '../agent/options.ts';
import type { McpServerConfig, ApiConfig } from './types.ts';
import { debug } from '../utils/debug.ts';
import { EXTRACTION_MODEL } from '../config/models.ts';

export interface ExtractionResult {
  instructions: string;
  instructionsBlockId?: string;
  mcpServers?: McpServerConfig[];
  apis?: ApiConfig[];  // REST API configurations extracted from curl examples or docs
  info?: string[];  // Info messages for users (notices, etc.)
  warnings?: string[];  // Warnings about potential issues (non-blocking, informational)
  capabilities?: string[];  // Auto-generated list of key capabilities
  error?: {
    code: 'insufficient_credits' | 'auth_error' | 'extraction_failed';
    message: string;
  };
}

export interface ExtractionProgressEvent {
  type: 'tool_start' | 'tool_complete' | 'status';
  toolName?: string;
  message: string;
}

/**
 * Handle for a cancellable extraction operation
 */
export interface ExtractionHandle {
  /** Promise that resolves with the extraction result */
  result: Promise<ExtractionResult>;
  /** Cancel the extraction - stops the query and returns empty result */
  cancel: () => void;
}

/**
 * Format tool name into a human-readable progress message
 */
function formatToolMessage(toolName: string): string {
  if (toolName === 'mcp__craft__blocks_get') {
    return 'Reading document blocks...';
  }
  if (toolName === 'mcp__craft__document_get') {
    return 'Fetching document...';
  }
  if (toolName.startsWith('mcp__craft__')) {
    return `Running ${toolName.replace('mcp__craft__', '')}...`;
  }
  return `Running ${toolName}...`;
}

/**
 * Extract agent definition using agentic approach
 *
 * Claude will:
 * 1. Use Craft MCP tools to read the document
 * 2. Navigate the document structure as needed
 * 3. Extract and return structured JSON
 */
export async function extractAgentDefinition(
  documentId: string,
  agentName: string,
  model: string,
  mcpUrl: string,
  mcpToken?: string,
  onProgress?: (event: ExtractionProgressEvent) => void,
): Promise<ExtractionResult> {
  debug('[extractor] Starting agentic extraction for agent:', agentName, 'documentId:', documentId);

  try {
    // Configure Craft MCP server for the agent query
    const mcpServers: Options['mcpServers'] = {
      craft: {
        type: 'http',
        url: mcpUrl,
        ...(mcpToken ? { headers: { Authorization: `Bearer ${mcpToken}` } } : {}),
      },
    };

    // System prompt for the extractor agent
    const systemPrompt = `You are an agent definition extractor.

CRITICAL OUTPUT RULES - YOU MUST FOLLOW THESE:
- Your final response must be ONLY a JSON object
- NO text before the JSON (no "Here is", "Perfect!", etc.)
- NO text after the JSON
- NO explanations or commentary
- Start directly with { and end with }

Your task:
1. Use mcp__craft__blocks_get to read Craft documents
2. Extract agent instructions from the content
3. Return ONLY the JSON object - nothing else`;

    const prompt = `Extract agent definition from Craft document ID "${documentId}" (agent: "${agentName}").

CRITICAL ID DISTINCTION:
- Document ID: "${documentId}" - This is the ID of the agent's document. Use this when referring to "the document" or "this document".
- Block IDs: The nested blocks inside the document have their own IDs (e.g., for Instructions subpage). Use these only when referring to specific blocks within the document.
- NEVER use a block ID when you mean the document ID. They are different!

=== INCREMENTAL LOADING STRATEGY ===

Use a conservative, step-by-step approach to minimize unnecessary data loading:

STEP 1: Get Document Outline (REQUIRED)
- Call mcp__craft__blocks_get with id="${documentId}" and maxDepth=1
- This gives you the top-level structure: document title and immediate children
- Examine the block titles/content to identify:
  * Instructions section (PRIORITY) - Look for pages named "Instructions", "AI Instructions",
    "Agent Instructions", "System Prompt", "Prompt", "Behavior", "Persona", or similar
  * If no such section exists, the document root content IS the instructions
  * "MCP Servers" or similar sections (may contain server configs)
  * Code blocks at the top level (may contain inline configs)
  * Any section names suggesting APIs, integrations, or configurations

STEP 2: Load Instructions Content (REQUIRED)
There are two valid document structures:

A) Document has an Instructions-like subpage:
   Look for a root-level page with a name that suggests it contains agent instructions:
   - Exact matches: "Instructions", "AI Instructions", "Agent Instructions"
   - Similar names: "System Prompt", "Prompt", "Behavior", "Persona", "Config"
   - Any page that contextually appears to define how the agent should behave

   If found:
   - Note that block's ID (different from ${documentId})
   - Call mcp__craft__blocks_get with id="[instructions_block_id]" and maxDepth=2
   - Use that block ID as instructionsBlockId

B) Document root IS the instructions (no Instructions-like subpage):
   - The content from Step 1 IS the instructions
   - Leave instructionsBlockId empty/null (there is no dedicated instructions block)
   - This is a valid structure, NOT an error

Both structures are equally valid. Do NOT add info messages about missing Instructions sections.

STEP 3: Selectively Load Additional Sections (CONDITIONAL)
Only load additional sections if Step 1 revealed potentially relevant content:

a) MCP Server Sections:
   - If you see a section like "MCP Servers", "Servers", "Integrations", "Configuration":
     * Load that specific block with maxDepth=1 or maxDepth=2
   - If top-level code blocks exist, they may already contain server configs from Step 1

b) API Documentation Sections:
   - If you see sections like "APIs", "REST APIs", "Endpoints", "Integration Guide":
     * Load that specific block with maxDepth=2
   - Look for sections containing words: curl, fetch, API, endpoint, request

c) Code Blocks Discovery:
   - If you saw code blocks in Step 1 outline but couldn't read their content:
     * Load those specific blocks to see if they contain MCP or API configs

STEP 4: Final Pass (ONLY IF NEEDED)
- If after Steps 1-3 you still haven't found expected content:
  * You may load the full document with maxDepth=3 as a fallback
  * But ONLY do this if the incremental approach failed to find Instructions
- Most documents should NOT need this step

=== DECISION GUIDELINES ===

DO load a section if:
- It's named "Instructions" (always load this)
- It contains the word "MCP", "Server", "API", "Config", "Integration"
- It's a code block that might contain configuration
- The outline suggests it has relevant content

DO NOT load a section if:
- It's clearly unrelated (e.g., "Meeting Notes", "Archive", "Drafts")
- It's a large section with no indication of agent-relevant content
- You already have the information you need

=== EXTRACTION REQUIREMENTS ===

From the loaded content, extract:

1. INSTRUCTIONS (Primary Goal)
Extract the EXACT original instructions without modification. Critical rules:
- Do NOT prepend any identity context - that is added at runtime
- Do NOT add document IDs or agent names to the instructions
- Preserve the EXACT wording, structure, and formatting from the original document
- Fix only obvious formatting issues (e.g., broken markdown)
- Keep human-friendly references like "this document", "this page", "the Instructions section"

API KEY/AUTHENTICATION INSTRUCTIONS - REMOVE THESE:
The system automatically collects API keys during agent setup and injects them into requests.
REMOVE any instructions about API key acquisition or setup from the extracted instructions, including:
- "Get your API key from..."
- "You'll need to provide an API key..."
- "Sign up at [service] to get an API key"
- "Set your API key in the environment..."
- "The user will provide the API key..."
- Any instructions telling the user OR agent how to obtain/configure API credentials
These are setup concerns, not agent behavior. The extracted instructions should focus on WHAT the agent does, not HOW to authenticate.

2. MCP SERVER CONFIGURATIONS
- Look for MCP server configurations in code blocks (YAML, JSON, or plain URLs)
- ONLY include servers with HTTP/HTTPS URLs in the mcpServers array
- if authentication type (OAuth, API token, or public) is not specified or implied by the MCP configuration, assume the server is authenticated with OAuth.
- UNSUPPORTED server types (do NOT include in mcpServers):
  * npx commands (e.g., "npx -y @modelcontextprotocol/server-filesystem")
  * command/args configs (e.g., { "command": "npx", "args": [...] })
  * stdio transports
  * Any server config without an http:// or https:// URL

3. REST API DOCUMENTATION EXTRACTION
Look for REST API configurations and extract COMPREHENSIVE documentation.
These are NOT MCP servers, but regular HTTP APIs that will become flexible tools.

IMPORTANT: Each API will become ONE tool that accepts { path, method, params }.
Authentication is FULLY AUTOMATIC:
- API keys are collected from the user during agent setup (not at runtime)
- The system injects authentication into every request automatically
- The agent NEVER sees, handles, or needs to know about API keys
- You just need to identify WHAT TYPE of auth the API uses so we can inject it correctly

Detect APIs from:
- curl examples (e.g., curl -X POST https://api.example.com/search -H "x-api-key: KEY" -d '{"query": "test"}')
- fetch() calls or axios requests
- Inline API documentation describing endpoints
- Links to API documentation pages

For each API found, extract:
- name: Short identifier (e.g., "exa", "openai") - derive from hostname if not explicit
- baseUrl: Base URL without path (e.g., "https://api.exa.ai")
- auth: Authentication config - identify the TYPE so the system can inject credentials:
  SUPPORTED AUTH TYPES (pick one):
  - type: "none" - No authentication required (public API, free tier, etc.)
    No additional fields needed. The credential prompt will be skipped entirely.
  - type: "header" - Custom header auth (e.g., -H "x-api-key: KEY")
    Set headerName to the header name (e.g., "x-api-key", "X-API-Key")
  - type: "bearer" - Authorization header auth (e.g., -H "Authorization: Bearer KEY")
    Set authScheme if NOT "Bearer" (e.g., "Token", "ApiKey", "Key")
    Default authScheme is "Bearer" if not specified
  - type: "query" - Query parameter auth (e.g., ?api_key=KEY or ?key=KEY)
    Set queryParam to the parameter name (e.g., "api_key", "key", "token")
  - type: "basic" - HTTP Basic Authentication (username:password)
    User will be prompted for two credentials separately.

  CREDENTIAL LABELS (extract from document context):
  - credentialLabel: What the document calls the first/main credential
    Examples: "API Key", "Access Token", "Client ID", "App Key"
    For basic auth, this is what they call the username-equivalent (e.g., "API Key")
  - secretLabel: For basic auth only - what they call the password-equivalent
    Examples: "Secret Key", "API Secret", "Client Secret"

  Look for phrases like "API_KEY:SECRET_KEY", "client_id:client_secret", etc. to determine labels.

  How to determine auth type (CHECK IN THIS ORDER):
  1. Look at curl examples or code snippets FIRST - they are the most reliable source
  2. If you see -H "Authorization: Bearer xxx" → use "bearer"
  3. If you see -H "Authorization: Token xxx" → use "bearer" with authScheme: "Token"
  4. If you see -H "x-api-key: xxx" or similar custom header → use "header" with headerName
  5. If you see ?api_key=xxx in URL → use "query" with queryParam
  6. If you see curl -u username:password OR -H "Authorization: Basic xxx" → use "basic"
  7. If no auth in examples AND API is described as public/free → use "none"
  8. If unclear but API requires auth → default to "bearer"

  IMPORTANT: Do NOT use "basic" just because the word "basic" appears in the document.
  Only use "basic" if you see ACTUAL HTTP Basic Authentication patterns:
  - curl -u user:pass
  - Authorization: Basic <base64>
  - Explicit mention of "HTTP Basic Authentication" as the auth method
- documentation: COMPREHENSIVE markdown documentation that will be included in the tool description.
  This is CRITICAL - the agent uses this to figure out how to call the API. Include:
  * ALL available endpoints with their paths and HTTP methods
  * Parameter descriptions with types and valid values
  * Example requests showing typical usage (as JSON objects - NO auth headers needed in examples)
  * Response format descriptions if available
  * Rate limits and constraints if mentioned
  * PAGINATION DETAILS ARE CRITICAL - mention any limit/count/numResults params prominently
  * Related endpoint relationships (e.g., "use /contents after /search")

  DO NOT include in documentation:
  * How to get an API key
  * Authentication setup instructions
  * API key headers in examples (auth is injected automatically)

  Format as readable markdown. Example documentation field:
  """
  ## Endpoints

  ### POST /search
  Search the web using neural or keyword search.

  **Parameters:**
  - query (string, required): Search query
  - numResults (int, 1-100, default 10): Number of results. START WITH 5-10 to avoid huge responses.
  - type (string): "neural" for semantic search, "keyword" for exact match
  - category (string, optional): "news", "research paper", "company", "github"

  **Example:** {"query": "AI news", "numResults": 5, "type": "neural"}

  ### POST /contents
  Get full page content for URLs. Use after /search to get full content of relevant results.

  **Parameters:**
  - urls (array of strings, required): URLs to fetch content from
  - text (object, optional): {maxCharacters: 1000} to limit content length

  **Example:** {"urls": ["https://example.com"], "text": {"maxCharacters": 5000}}
  """
- docsUrl: Link to official API documentation if found (optional)

4. INFO MESSAGES
Use the "info" array to communicate important information to the user. You MUST add info messages for:
- Unsupported MCP servers: "MCP server '[name]' uses npx/stdio which is not supported. Only HTTP/HTTPS servers work."
- Empty document (no content at all): "Document has no content."
- Malformed or unparseable MCP configs: "Could not parse MCP server config in code block."
- APIs found: "Found API '[name]'."
- Unsupported automation features (see below): Add info message explaining the limitation
- Any other issues or warnings the user should know about during agent setup

PLATFORM LIMITATIONS - IMPORTANT:
This is an interactive CLI tool. It CANNOT:
- Run automatically or on a schedule (no cron, no background tasks)
- Wake up or trigger itself (no webhooks, no event listeners)
- Run continuously in the background
- Send notifications or alerts proactively
- Set or schedule reminders
- Monitor things over time without user interaction

If the instructions mention ANY of these features, add an info message like:
"Note: '[feature]' requires automation/scheduling which is not supported. This agent only responds when you interact with it."

EXTERNAL SERVICE INTEGRATIONS:
If instructions mention external services (email, Slack, Discord, GitHub, calendar, etc.) that aren't already configured:
- Add info: "To enable [service] integration, add an API config (curl examples or API docs) or MCP server config as a code block in this document."
- Common examples:
  * Email: "To send emails, add an API config for SendGrid, Resend, or similar email service."
  * Slack/Discord: "To post messages, add a Slack/Discord API config or MCP server."
  * GitHub: "To interact with GitHub, add the GitHub API or an MCP server config."
- Do NOT treat missing integrations as warnings - just provide helpful guidance as info messages.

Do NOT create warnings that require user action about these limitations - they cannot be resolved. Just inform the user via info messages.

5. CAPABILITIES SUMMARY
Analyze the instructions and extract a list of 3-8 key capabilities this agent has.
Each capability should be a concise phrase (5-15 words) describing what the agent can do.
Examples: "Search the web using Exa neural search", "Create and edit Craft documents", "Write and debug TypeScript code"

6. WARNINGS (NON-BLOCKING)
Generate simple warning strings for issues the user should be aware of.
Warnings are informational only - they do NOT block agent activation.

Generate warnings ONLY for:
1. Empty/minimal document - "Document has no content" or "Instructions are very minimal"
2. Clear contradictions - "Instructions contain conflicting requirements: [brief description]"
3. Platform limitations - "[Feature X] requires automation/scheduling which is not supported"

DO NOT generate warnings for:
- Minor ambiguities that Claude can handle
- Suggestions for improvement
- Missing integrations (use info messages instead)
- Anything that would require user input to resolve

NEVER include API keys, tokens, or sensitive information in warnings.

When document is EMPTY (no content at all):
- Return empty instructions string ""
- Add warning: "Document has no content."

When document has content but no "Instructions" subpage:
- The root content IS the instructions - extract it normally
- Leave instructionsBlockId empty/null (no dedicated instructions block exists)
- This is NOT an error - do not add warnings about it

If instructions are clear and complete, return empty warnings array [].

REMEMBER: "${documentId}" is the DOCUMENT ID. The instructionsBlockId should be:
- The block ID of the Instructions subpage (if one exists), OR
- Empty/null (if the root content IS the instructions - there is no separate block)

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "instructions": "[EXACT instruction content from document - no identity prefix added]",
  "instructionsBlockId": "[block ID of Instructions subpage, OR empty if instructions are at document root]",
  "mcpServers": [{ "name": "myserver", "url": "https://example.com/mcp", "requiresAuth": false }],
  "apis": [{
    "name": "exa",
    "baseUrl": "https://api.exa.ai",
    "auth": { "type": "header", "headerName": "x-api-key" },
    "documentation": "## Endpoints\\n\\n### POST /search\\nSearch the web using neural or keyword search.\\n\\n**Parameters:**\\n- query (string, required)\\n- numResults (int, 1-100, default 10)\\n\\n**Example:** {\"query\": \"AI news\", \"numResults\": 5}",
    "docsUrl": "https://docs.exa.ai"
  }],
  "info": ["Found API 'exa'."],
  "capabilities": ["Search the web using Exa neural search", "Process and analyze search results"],
  "warnings": []
}

Rules:
- mcpServers: Empty array [] if no HTTP/HTTPS MCP servers found
- apis: Empty array [] if no REST APIs found. Include APIs even if only one endpoint is detected.
- info: Empty array [] if nothing to report. MUST contain messages for any issues or important information.
- capabilities: List of 3-8 key capabilities. Empty array [] if instructions are empty.
- warnings: Empty array [] if instructions are clear. Only add for empty docs, contradictions, or platform limitations.
- instructions: Empty string "" if document is empty or not found`;

    const options: Options = {
      ...getDefaultOptions(),
      model: EXTRACTION_MODEL,
      systemPrompt,
      mcpServers,
      maxTurns: 10, // Allow multiple tool calls if needed
      // Use Claude Code toolset for full capabilities
      tools: { type: 'preset', preset: 'claude_code' },
      // Allow all tools without permission prompts
      permissionMode: 'acceptEdits',
      canUseTool: async (_toolName, input) => {
        return { behavior: 'allow' as const, updatedInput: input as Record<string, unknown> };
      },
      // Capture stderr from SDK subprocess for debugging
      stderr: (data: string) => {
        debug('[extractor] SDK stderr:', data);
      },
      // Structured output guarantees valid JSON matching schema
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            instructions: {
              type: 'string',
              description: 'The complete agent instructions, prepended with agent identity context',
            },
            instructionsBlockId: {
              type: 'string',
              description: 'Block ID of the instructions section for self-modification',
            },
            mcpServers: {
              type: 'array',
              description: 'MCP server configurations found in the document',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string' },
                  requiresAuth: { type: 'boolean' },
                },
              },
            },
            apis: {
              type: 'array',
              description: 'REST APIs detected from curl examples or documentation',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Short name like "exa", "openai"' },
                  baseUrl: { type: 'string', description: 'Base URL without path' },
                  auth: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['none', 'header', 'bearer', 'query', 'basic'] },
                      headerName: { type: 'string', description: 'Header name for type=header' },
                      queryParam: { type: 'string', description: 'Query param for type=query' },
                      authScheme: { type: 'string', description: 'Custom Authorization scheme for type=bearer (default: Bearer). Examples: Token, ApiKey' },
                      credentialLabel: { type: 'string', description: 'Custom label for credential prompt (e.g., "API Key"). For basic auth, this is the username-equivalent label.' },
                      secretLabel: { type: 'string', description: 'For basic auth: label for password-equivalent (e.g., "Secret Key")' },
                    },
                  },
                  documentation: {
                    type: 'string',
                    description: 'CRITICAL: Comprehensive API reference as markdown text. Include all endpoints with paths, methods, parameters, examples, and constraints. This becomes the tool description.',
                  },
                  docsUrl: { type: 'string', description: 'Link to official API documentation if found' },
                },
                required: ['name', 'baseUrl', 'documentation'],
              },
            },
            info: {
              type: 'array',
              description: 'User-facing info messages about the extraction (warnings, notices, etc.)',
              items: { type: 'string' },
            },
            capabilities: {
              type: 'array',
              description: 'List of 3-8 key capabilities this agent has',
              items: { type: 'string' },
            },
            warnings: {
              type: 'array',
              description: 'Warnings about potential issues (non-blocking, informational)',
              items: { type: 'string' },
            },
          },
          required: ['instructions', 'instructionsBlockId'],
        },
      },
    };

    debug('[extractor] Running agentic query with MCP URL:', mcpUrl);

    // Run agentic query - Claude will use MCP tools to read the document
    let result: ExtractionResult | null = null;

    for await (const message of query({ prompt, options })) {
      // Log tool usage for debugging and emit progress events
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            debug('[extractor] Tool call:', block.name, JSON.stringify(block.input));

            // Emit progress event
            debug('[extractor] Emitting progress event for tool:', block.name);
            onProgress?.({
              type: 'tool_start',
              toolName: block.name,
              message: formatToolMessage(block.name),
            });
          }
        }
      }

      // Log result message details
      if (message.type === 'result') {
        debug('[extractor] Result message subtype:', message.subtype);
        debug('[extractor] Result message has structured_output:', 'structured_output' in message);
        if (message.subtype === 'success') {
          debug('[extractor] Success result:', message.result);
          debug('[extractor] structured_output:', message.structured_output);
        } else {
          debug('[extractor] Error result, errors:', (message as any).errors);
        }
      }

      // Access structured output from result message
      if (message.type === 'result' && message.subtype === 'success') {
        if (message.structured_output) {
          // SDK parsed it for us
          debug('[extractor] Got structured_output from SDK');
          result = message.structured_output as ExtractionResult;
        } else if (message.result) {
          // Fallback: parse the result text (SDK may not populate structured_output with claude_code preset)
          debug('[extractor] Falling back to parsing result text');
          try {
            let jsonText = message.result.trim();

            // Strategy 1: Try direct parse (if Claude followed instructions perfectly)
            if (jsonText.startsWith('{')) {
              result = JSON.parse(jsonText) as ExtractionResult;
              debug('[extractor] Parsed direct JSON');
            } else {
              // Strategy 2: Extract JSON from markdown code block anywhere in response
              const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              if (codeBlockMatch && codeBlockMatch[1]) {
                result = JSON.parse(codeBlockMatch[1].trim()) as ExtractionResult;
                debug('[extractor] Parsed JSON from code block');
              } else {
                // Strategy 3: Find JSON object anywhere in text (greedy match for outermost braces)
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  result = JSON.parse(jsonMatch[0]) as ExtractionResult;
                  debug('[extractor] Parsed JSON from text');
                }
              }
            }
          } catch (parseError) {
            debug('[extractor] Failed to parse result text:', parseError);
          }
        }
      }
    }

    if (!result) {
      debug('[extractor] No structured output received');
      return { instructions: '', mcpServers: [], apis: [], warnings: [], capabilities: [] };
    }

    debug(
      '[extractor] Extracted',
      result.instructions?.length || 0,
      'chars of instructions,',
      result.mcpServers?.length || 0,
      'MCP servers,',
      result.apis?.length || 0,
      'APIs,',
      result.info?.length || 0,
      'info messages,',
      result.capabilities?.length || 0,
      'capabilities,',
      result.warnings?.length || 0,
      'warnings',
    );

    return {
      instructions: result.instructions || '',
      instructionsBlockId: result.instructionsBlockId || undefined,
      mcpServers: result.mcpServers || [],
      apis: result.apis || [],
      info: result.info || [],
      warnings: result.warnings || [],
      capabilities: result.capabilities || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debug('[extractor] Agentic extraction failed:', errorMessage);
    debug('[extractor] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return {
      instructions: '',
      mcpServers: [],
      apis: [],
      warnings: [],
      capabilities: [],
    };
  }
}

/**
 * Start a cancellable extraction operation
 *
 * Returns an ExtractionHandle with:
 * - result: Promise<ExtractionResult> that resolves when extraction completes
 * - cancel(): void to interrupt the extraction
 *
 * When cancelled, the result promise resolves with an empty ExtractionResult.
 */
export function startExtraction(
  documentId: string,
  agentName: string,
  model: string,
  mcpUrl: string,
  mcpToken?: string,
  onProgress?: (event: ExtractionProgressEvent) => void,
): ExtractionHandle {
  let cancelled = false;
  let queryHandle: ReturnType<typeof query> | null = null;

  const result = (async (): Promise<ExtractionResult> => {
    // Delegate to the existing extraction function but with cancellation check
    // We need to run the extraction in a way that we can interrupt it
    debug('[extractor] Starting cancellable extraction for agent:', agentName);
    console.log('[extractor] Starting extraction for:', agentName, 'documentId:', documentId);

    // Track 402 errors that may come through stderr (defined outside try so it's accessible in catch)
    let stderrDetected402 = false;

    try {
      // Build options just like extractAgentDefinition
      const mcpServers: Options['mcpServers'] = {
        craft: {
          type: 'http',
          url: mcpUrl,
          ...(mcpToken ? { headers: { Authorization: `Bearer ${mcpToken}` } } : {}),
        },
      };

      console.log('[extractor] MCP URL:', mcpUrl, 'hasToken:', !!mcpToken);

      const systemPrompt = buildExtractionSystemPrompt();
      const prompt = buildExtractionPrompt(documentId, agentName);

      console.log('[extractor] Using model:', EXTRACTION_MODEL);

      const options: Options = {
        ...getDefaultOptions(),
        model: EXTRACTION_MODEL,
        systemPrompt,
        mcpServers,
        maxTurns: 10,
        tools: { type: 'preset', preset: 'claude_code' },
        permissionMode: 'acceptEdits',
        canUseTool: async (_toolName, input) => {
          return { behavior: 'allow' as const, updatedInput: input as Record<string, unknown> };
        },
        stderr: (data: string) => {
          debug('[extractor] SDK stderr:', data);
          // Also log to console for debugging
          console.log('[extractor] SDK stderr:', data);
          // Check for 402 errors in stderr (these may come before result messages)
          if (data.includes('402') || data.toLowerCase().includes('payment required') || data.toLowerCase().includes('insufficient credits')) {
            console.log('[extractor] Detected 402 error in stderr');
            stderrDetected402 = true;
          }
        },
        outputFormat: buildExtractionOutputFormat(),
      };

      debug('[extractor] Running cancellable query with MCP URL:', mcpUrl);
      console.log('[extractor] Starting query...');

      // Create query and store handle for interrupt
      queryHandle = query({ prompt, options });

      let extractionResult: ExtractionResult | null = null;
      let messageCount = 0;

      for await (const message of queryHandle) {
        messageCount++;
        console.log('[extractor] Message #' + messageCount + ' type:', message.type, 'subtype:', (message as any).subtype || 'N/A');

        // Check if cancelled
        if (cancelled) {
          debug('[extractor] Extraction cancelled, breaking loop');
          console.log('[extractor] Cancelled, breaking');
          break;
        }

        // Process progress events
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'tool_use') {
              debug('[extractor] Tool call:', block.name, JSON.stringify(block.input));
              console.log('[extractor] Tool call:', block.name);
              onProgress?.({
                type: 'tool_start',
                toolName: block.name,
                message: formatToolMessage(block.name),
              });
            } else if (block.type === 'text') {
              console.log('[extractor] Assistant text (first 200 chars):', (block as any).text?.substring(0, 200));
            }
          }
        }

        // Extract result
        if (message.type === 'result') {
          console.log('[extractor] Got result message, subtype:', (message as any).subtype);
          console.log('[extractor] Has structured_output:', !!(message as any).structured_output);
          console.log('[extractor] Has result:', !!(message as any).result);

          if ((message as any).subtype === 'error') {
            const errorInfo = JSON.stringify((message as any).errors || (message as any).error || 'unknown error');
            console.log('[extractor] ERROR result:', errorInfo);

            // Check for 402 Payment Required errors
            if (errorInfo.includes('402') || errorInfo.toLowerCase().includes('payment required') || errorInfo.toLowerCase().includes('insufficient credits')) {
              console.log('[extractor] Detected 402 error in result, returning error');
              return {
                instructions: '',
                mcpServers: [],
                apis: [],
                warnings: [],
                capabilities: [],
                error: {
                  code: 'insufficient_credits',
                  message: 'Your Craft Credits balance is empty. Please top up your credits to continue.',
                },
              };
            }
          }

          if (message.subtype === 'success') {
            console.log('[extractor] Success! Checking for structured_output...');
            if (message.structured_output) {
              console.log('[extractor] Got structured_output, instructions length:', (message.structured_output as any)?.instructions?.length || 0);
              extractionResult = message.structured_output as ExtractionResult;
            } else if (message.result) {
              console.log('[extractor] No structured_output, parsing result text (first 500 chars):', message.result.substring(0, 500));
              extractionResult = parseExtractionResult(message.result);
              console.log('[extractor] Parsed result, instructions length:', extractionResult?.instructions?.length || 0);
            } else {
              console.log('[extractor] No structured_output AND no result text!');
            }
          }
        }
      }

      console.log('[extractor] Query loop finished. Total messages:', messageCount, 'stderrDetected402:', stderrDetected402);

      if (cancelled) {
        debug('[extractor] Returning empty result due to cancellation');
        console.log('[extractor] Returning empty (cancelled)');
        return { instructions: '', mcpServers: [], apis: [], warnings: [], capabilities: [] };
      }

      // If we detected a 402 error via stderr, return it
      if (stderrDetected402) {
        console.log('[extractor] Returning insufficient credits error');
        return {
          instructions: '',
          mcpServers: [],
          apis: [],
          warnings: [],
          capabilities: [],
          error: {
            code: 'insufficient_credits',
            message: 'Your Craft Credits balance is empty. Please top up your credits to continue.',
          },
        };
      }

      if (!extractionResult) {
        debug('[extractor] No structured output received');
        console.log('[extractor] ERROR: No extraction result after', messageCount, 'messages');
        return { instructions: '', mcpServers: [], apis: [], warnings: [], capabilities: [] };
      }

      console.log('[extractor] Final result - instructions:', extractionResult.instructions?.length || 0, 'chars');

      debug(
        '[extractor] Extracted',
        extractionResult.instructions?.length || 0,
        'chars of instructions,',
        extractionResult.mcpServers?.length || 0,
        'MCP servers,',
        extractionResult.apis?.length || 0,
        'APIs,',
        extractionResult.warnings?.length || 0,
        'warnings',
      );

      return {
        instructions: extractionResult.instructions || '',
        instructionsBlockId: extractionResult.instructionsBlockId || undefined,
        mcpServers: extractionResult.mcpServers || [],
        apis: extractionResult.apis || [],
        info: extractionResult.info || [],
        warnings: extractionResult.warnings || [],
        capabilities: extractionResult.capabilities || [],
      };
    } catch (error) {
      if (cancelled) {
        debug('[extractor] Extraction cancelled (error in cancelled state)');
        console.log('[extractor] Cancelled with error');
        return { instructions: '', mcpServers: [], apis: [], warnings: [], capabilities: [] };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('[extractor] Cancellable extraction failed:', errorMessage);
      console.error('[extractor] EXCEPTION:', error);
      console.error('[extractor] Stack:', error instanceof Error ? error.stack : 'no stack');
      console.log('[extractor] stderrDetected402 in catch:', stderrDetected402);

      // Check for 402 Payment Required (insufficient credits) - check both error message AND stderr flag
      if (stderrDetected402 || errorMessage.includes('402') || errorMessage.toLowerCase().includes('payment required') || errorMessage.toLowerCase().includes('insufficient credits')) {
        console.log('[extractor] Returning insufficient credits error (stderrDetected402:', stderrDetected402, ')');
        return {
          instructions: '',
          mcpServers: [],
          apis: [],
          warnings: [],
          capabilities: [],
          error: {
            code: 'insufficient_credits',
            message: 'Your Craft Credits balance is empty. Please top up your credits to continue.',
          },
        };
      }

      // Check for auth errors
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('authentication')) {
        console.log('[extractor] Detected authentication error');
        return {
          instructions: '',
          mcpServers: [],
          apis: [],
          warnings: [],
          capabilities: [],
          error: {
            code: 'auth_error',
            message: 'Authentication failed. Please check your credentials.',
          },
        };
      }

      return { instructions: '', mcpServers: [], apis: [], warnings: [], capabilities: [] };
    }
  })();

  return {
    result,
    cancel: () => {
      debug('[extractor] Cancel requested');
      console.log('[extractor] Cancel requested');
      cancelled = true;
      if (queryHandle) {
        queryHandle.interrupt();
      }
    },
  };
}

/**
 * Build the system prompt for extraction
 */
function buildExtractionSystemPrompt(): string {
  return `You are an agent definition extractor.

CRITICAL OUTPUT RULES - YOU MUST FOLLOW THESE:
- Your final response must be ONLY a JSON object
- NO text before the JSON (no "Here is", "Perfect!", etc.)
- NO text after the JSON
- NO explanations or commentary
- Start directly with { and end with }

Your task:
1. Use mcp__craft__blocks_get to read Craft documents
2. Extract agent instructions from the content
3. Return ONLY the JSON object - nothing else`;
}

/**
 * Build the extraction prompt
 */
function buildExtractionPrompt(documentId: string, agentName: string): string {
  // This is the same prompt from extractAgentDefinition
  // Extracted to a function for reuse
  return `Extract agent definition from Craft document ID "${documentId}" (agent: "${agentName}").

CRITICAL ID DISTINCTION:
- Document ID: "${documentId}" - This is the ID of the agent's document. Use this when referring to "the document" or "this document".
- Block IDs: The nested blocks inside the document have their own IDs (e.g., for Instructions subpage). Use these only when referring to specific blocks within the document.
- NEVER use a block ID when you mean the document ID. They are different!

=== INCREMENTAL LOADING STRATEGY ===

Use a conservative, step-by-step approach to minimize unnecessary data loading:

STEP 1: Get Document Outline (REQUIRED)
- Call mcp__craft__blocks_get with id="${documentId}" and maxDepth=1
- This gives you the top-level structure: document title and immediate children
- Examine the block titles/content to identify:
  * Instructions section (PRIORITY) - Look for pages named "Instructions", "AI Instructions",
    "Agent Instructions", "System Prompt", "Prompt", "Behavior", "Persona", or similar
  * If no such section exists, the document root content IS the instructions
  * "MCP Servers" or similar sections (may contain server configs)
  * Code blocks at the top level (may contain inline configs)
  * Any section names suggesting APIs, integrations, or configurations

STEP 2: Load Instructions Content (REQUIRED)
There are two valid document structures:

A) Document has an Instructions-like subpage:
   Look for a root-level page with a name that suggests it contains agent instructions:
   - Exact matches: "Instructions", "AI Instructions", "Agent Instructions"
   - Similar names: "System Prompt", "Prompt", "Behavior", "Persona", "Config"
   - Any page that contextually appears to define how the agent should behave

   If found:
   - Note that block's ID (different from ${documentId})
   - Call mcp__craft__blocks_get with id="[instructions_block_id]" and maxDepth=2
   - Use that block ID as instructionsBlockId

B) Document root IS the instructions (no Instructions-like subpage):
   - The content from Step 1 IS the instructions
   - Leave instructionsBlockId empty/null (there is no dedicated instructions block)
   - This is a valid structure, NOT an error

Both structures are equally valid. Do NOT add info messages about missing Instructions sections.

STEP 3: Selectively Load Additional Sections (CONDITIONAL)
Only load additional sections if Step 1 revealed potentially relevant content:

a) MCP Server Sections:
   - If you see a section like "MCP Servers", "Servers", "Integrations", "Configuration":
     * Load that specific block with maxDepth=1 or maxDepth=2
   - If top-level code blocks exist, they may already contain server configs from Step 1

b) API Documentation Sections:
   - If you see sections like "APIs", "REST APIs", "Endpoints", "Integration Guide":
     * Load that specific block with maxDepth=2
   - Look for sections containing words: curl, fetch, API, endpoint, request

c) Code Blocks Discovery:
   - If you saw code blocks in Step 1 outline but couldn't read their content:
     * Load those specific blocks to see if they contain MCP or API configs

STEP 4: Final Pass (ONLY IF NEEDED)
- If after Steps 1-3 you still haven't found expected content:
  * You may load the full document with maxDepth=3 as a fallback
  * But ONLY do this if the incremental approach failed to find Instructions
- Most documents should NOT need this step

=== EXTRACTION REQUIREMENTS ===

From the loaded content, extract:

1. INSTRUCTIONS - Extract EXACT original instructions without modification
2. MCP SERVER CONFIGURATIONS - Only HTTP/HTTPS URLs
3. REST API DOCUMENTATION - Comprehensive API docs
4. INFO MESSAGES - Notices
5. CAPABILITIES SUMMARY - 3-8 key capabilities
6. WARNINGS - Non-blocking warnings about potential issues

=== OUTPUT FORMAT ===

Return ONLY valid JSON:
{
  "instructions": "[EXACT instruction content from document]",
  "instructionsBlockId": "[block ID of Instructions subpage, OR empty if at root]",
  "mcpServers": [{ "name": "myserver", "url": "https://example.com/mcp", "requiresAuth": false }],
  "apis": [{ "name": "exa", "baseUrl": "https://api.exa.ai", "auth": { "type": "header", "headerName": "x-api-key" }, "documentation": "..." }],
  "info": [],
  "capabilities": [],
  "warnings": []
}`;
}

/**
 * Build the output format schema for extraction
 */
function buildExtractionOutputFormat(): Options['outputFormat'] {
  return {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        instructions: {
          type: 'string',
          description: 'The complete agent instructions',
        },
        instructionsBlockId: {
          type: 'string',
          description: 'Block ID of the instructions section',
        },
        mcpServers: {
          type: 'array',
          description: 'MCP server configurations',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              url: { type: 'string' },
              requiresAuth: { type: 'boolean' },
            },
          },
        },
        apis: {
          type: 'array',
          description: 'REST APIs detected',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              baseUrl: { type: 'string' },
              auth: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['none', 'header', 'bearer', 'query', 'basic'] },
                  headerName: { type: 'string' },
                  queryParam: { type: 'string' },
                  authScheme: { type: 'string' },
                  credentialLabel: { type: 'string' },
                  secretLabel: { type: 'string' },
                },
              },
              documentation: { type: 'string' },
              docsUrl: { type: 'string' },
            },
            required: ['name', 'baseUrl', 'documentation'],
          },
        },
        info: {
          type: 'array',
          items: { type: 'string' },
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
        },
        warnings: {
          type: 'array',
          description: 'Non-blocking warnings about potential issues',
          items: { type: 'string' },
        },
      },
      required: ['instructions', 'instructionsBlockId'],
    },
  };
}

/**
 * Parse extraction result from text
 */
function parseExtractionResult(text: string): ExtractionResult | null {
  try {
    let jsonText = text.trim();

    // Strategy 1: Direct parse
    if (jsonText.startsWith('{')) {
      return JSON.parse(jsonText) as ExtractionResult;
    }

    // Strategy 2: Extract from code block
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return JSON.parse(codeBlockMatch[1].trim()) as ExtractionResult;
    }

    // Strategy 3: Find JSON object anywhere
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractionResult;
    }

    return null;
  } catch {
    return null;
  }
}
