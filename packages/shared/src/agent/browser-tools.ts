/**
 * Browser Tools (browser_navigate, browser_snapshot, browser_click, etc.)
 *
 * Session-scoped tools that enable the agent to interact with the built-in
 * in-app browser windows. Each tool delegates to BrowserPaneFns callbacks which are
 * wired by the Electron session manager to BrowserPaneManager.
 *
 * The session → browser instance mapping is handled by the callback provider
 * (getOrCreateForSession pattern), so tools don't need instance IDs.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Tool result type - matches MCP CallToolResult content blocks
type ToolResult = {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

function successResponse(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

// ============================================================================
// Browser Pane Function Interface
// ============================================================================

/**
 * Abstraction over BrowserPaneManager for use in session-scoped tools.
 * The Electron session manager creates this by binding to a specific session's
 * browser instance via getOrCreateForSession(sessionId).
 */
export interface BrowserScreenshotArgs {
  mode?: 'raw' | 'agent'
  refs?: string[]
  includeLastAction?: boolean
  includeMetadata?: boolean
}

export interface BrowserScreenshotResult {
  png: Buffer
  metadata?: Record<string, unknown>
}

export interface BrowserPaneFns {
  openPanel: () => Promise<{ instanceId: string }>;
  navigate: (url: string) => Promise<{ url: string; title: string }>;
  snapshot: () => Promise<{ url: string; title: string; nodes: Array<{ ref: string; role: string; name: string; value?: string; description?: string; focused?: boolean; checked?: boolean; disabled?: boolean }> }>;
  click: (ref: string) => Promise<void>;
  fill: (ref: string, value: string) => Promise<void>;
  select: (ref: string, value: string) => Promise<void>;
  screenshot: (args?: BrowserScreenshotArgs) => Promise<BrowserScreenshotResult>;
  scroll: (direction: 'up' | 'down' | 'left' | 'right', amount?: number) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  evaluate: (expression: string) => Promise<unknown>;
}

// ============================================================================
// Tool Factory Options
// ============================================================================

export interface BrowserToolsOptions {
  sessionId: string;
  /**
   * Lazy resolver for browser pane functions.
   * Called at execution time to get the current callback from the session registry.
   */
  getBrowserPaneFns: () => BrowserPaneFns | undefined;
}

// ============================================================================
// Tool Descriptions
// ============================================================================

const BROWSER_DESCRIPTIONS = {
  browser_open: `Open (or focus) an in-app browser window.

Ensures the session's browser instance is visible and focused.
Returns the browser instance ID that was opened/focused.`,

  browser_navigate: `Navigate the built-in browser to a URL.

The built-in browser windows run real Chromium content inside the app. Use this to load web pages for inspection, testing, or data extraction.

If the browser UI may be hidden, call \`browser_open\` first.

Returns the final URL and page title after navigation completes.`,

  browser_snapshot: `Get an accessibility tree snapshot of the current browser page.

Returns a structured list of interactive elements (buttons, links, inputs, etc.) and content nodes (headings, paragraphs, images) with ref IDs like @e1, @e2.

Use these refs with browser_click and browser_fill to interact with elements. The snapshot is the primary way to understand page structure — prefer it over screenshots for element interaction.`,

  browser_click: `Click an element in the browser by its ref ID (e.g., @e1).

Get refs from browser_snapshot first. This performs a real mouse click at the element's center coordinates.`,

  browser_fill: `Fill a text input or textarea in the browser by its ref ID.

Clears the existing value first, then types the new value character by character. Get refs from browser_snapshot first.`,

  browser_select: `Select an option in a <select> dropdown by its ref ID.

Pass the option's value attribute. Get refs from browser_snapshot first.`,

  browser_screenshot: `Take a screenshot of the current browser page.

Supports optional agent-focused annotations:
- mode: "raw" (default) or "agent"
- refs: specific refs to annotate from browser_snapshot
- includeLastAction: include last interaction target when available
- includeMetadata: render compact metadata overlay and return metadata payload

Use browser_snapshot instead when you need to interact with elements — screenshots are primarily for visual verification.`,

  browser_scroll: `Scroll the browser page in a given direction.

Useful for revealing content below the fold before taking a snapshot. Default scroll amount is 500 pixels.`,

  browser_back: `Navigate the browser back to the previous page in history.`,

  browser_forward: `Navigate the browser forward to the next page in history.`,

  browser_evaluate: `Execute JavaScript in the browser page and return the result.

Use this for advanced interactions not covered by other browser tools, like reading computed styles, extracting data from the DOM, or triggering custom events.

The expression is evaluated in the page context. Return values are serialized to JSON.`,

  browser_tool: `Run browser actions using a CLI-like command string.

This is a convenience wrapper around browser_* tools with strict validation and actionable feedback.

Examples:
- \`--help\`
- \`open\`
- \`navigate https://example.com\`
- \`snapshot\`
- \`click @e12\`
- \`fill @e5 user@example.com\`
- \`select @e3 optionValue\`
- \`scroll down 800\`
- \`evaluate document.title\`

Prefer direct browser_* tools when exact structured arguments are available.`,
} as const;

// ============================================================================
// Tool Factories
// ============================================================================

export function createBrowserTools(options: BrowserToolsOptions) {
  function getBrowserFns(): BrowserPaneFns {
    const fns = options.getBrowserPaneFns();
    if (!fns) {
      throw new Error('Browser window controls are not available. This tool requires the desktop app.');
    }
    return fns;
  }

  function browserToolHelp(): string {
    return [
      'browser_tool command help',
      '',
      'Usage:',
      '  --help',
      '  open',
      '  navigate <url>',
      '  snapshot',
      '  click <ref>',
      '  fill <ref> <value>',
      '  select <ref> <value>',
      '  screenshot',
      '  scroll <up|down|left|right> [amount]',
      '  back',
      '  forward',
      '  evaluate <expression>',
      '',
      'Examples:',
      '  navigate https://example.com',
      '  click @e12',
      '  fill @e5 user@example.com',
      '  scroll down 800',
      '  evaluate document.title',
    ].join('\n');
  }

  async function runBrowserCommand(command: string): Promise<string> {
    const fns = getBrowserFns();
    const trimmed = command.trim();
    if (!trimmed) {
      throw new Error('Missing command. Use "--help" to see supported browser_tool commands.');
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
      return browserToolHelp();
    }

    if (cmd === 'open') {
      const result = await fns.openPanel();
      return `Opened in-app browser window (instance: ${result.instanceId})`;
    }

    if (cmd === 'navigate') {
      const url = parts.slice(1).join(' ').trim();
      if (!url) throw new Error('navigate requires a URL. Example: navigate https://example.com');
      const result = await fns.navigate(url);
      return `Navigated to: ${result.url}\nTitle: ${result.title}`;
    }

    if (cmd === 'snapshot') {
      const snapshot = await fns.snapshot();
      const lines: string[] = [
        `URL: ${snapshot.url}`,
        `Title: ${snapshot.title}`,
        '',
        `Elements (${snapshot.nodes.length}):`,
      ];
      for (const node of snapshot.nodes) {
        let line = `  ${node.ref} [${node.role}] "${node.name}"`;
        if (node.value !== undefined) line += ` value="${node.value}"`;
        if (node.focused) line += ' (focused)';
        if (node.checked) line += ' (checked)';
        if (node.disabled) line += ' (disabled)';
        if (node.description) line += ` — ${node.description}`;
        lines.push(line);
      }
      return lines.join('\n');
    }

    if (cmd === 'click') {
      const ref = parts[1];
      if (!ref) throw new Error('click requires a ref. Example: click @e1');
      await fns.click(ref);
      return `Clicked element ${ref}`;
    }

    if (cmd === 'fill') {
      const ref = parts[1];
      const value = parts.slice(2).join(' ');
      if (!ref || !value) throw new Error('fill requires ref and value. Example: fill @e5 hello world');
      await fns.fill(ref, value);
      return `Filled element ${ref} with "${value}"`;
    }

    if (cmd === 'select') {
      const ref = parts[1];
      const value = parts.slice(2).join(' ');
      if (!ref || !value) throw new Error('select requires ref and value. Example: select @e3 optionValue');
      await fns.select(ref, value);
      return `Selected "${value}" in element ${ref}`;
    }

    if (cmd === 'screenshot') {
      const result = await fns.screenshot();
      return `Screenshot captured (${Math.round(result.png.length / 1024)}KB PNG)`;
    }

    if (cmd === 'scroll') {
      const direction = parts[1] as 'up' | 'down' | 'left' | 'right' | undefined;
      const amountRaw = parts[2];
      if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
        throw new Error('scroll requires direction up|down|left|right. Example: scroll down 800');
      }
      const amount = amountRaw ? Number(amountRaw) : undefined;
      if (amountRaw && Number.isNaN(amount)) {
        throw new Error(`Invalid scroll amount "${amountRaw}". Expected a number.`);
      }
      await fns.scroll(direction, amount);
      return `Scrolled ${direction}${amount != null ? ` by ${amount}px` : ''}`;
    }

    if (cmd === 'back') {
      await fns.goBack();
      return 'Navigated back';
    }

    if (cmd === 'forward') {
      await fns.goForward();
      return 'Navigated forward';
    }

    if (cmd === 'evaluate') {
      const expression = parts.slice(1).join(' ').trim();
      if (!expression) throw new Error('evaluate requires an expression. Example: evaluate document.title');
      const result = await fns.evaluate(expression);
      return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    }

    throw new Error(`Unknown browser_tool command "${cmd}". Use "--help" to see supported commands.`);
  }

  return [
    // browser_open
    tool(
      'browser_open',
      BROWSER_DESCRIPTIONS.browser_open,
      {},
      async () => {
        try {
          const fns = getBrowserFns();
          const result = await fns.openPanel();
          return successResponse(`Opened in-app browser window (instance: ${result.instanceId})`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_navigate
    tool(
      'browser_navigate',
      BROWSER_DESCRIPTIONS.browser_navigate,
      {
        url: z.string().min(1).describe('URL to navigate to (e.g., "https://example.com" or "example.com")'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          const result = await fns.navigate(args.url);
          return successResponse(`Navigated to: ${result.url}\nTitle: ${result.title}`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_snapshot
    tool(
      'browser_snapshot',
      BROWSER_DESCRIPTIONS.browser_snapshot,
      {},
      async () => {
        try {
          const fns = getBrowserFns();
          const snapshot = await fns.snapshot();

          // Format as readable text for the agent
          const lines: string[] = [
            `URL: ${snapshot.url}`,
            `Title: ${snapshot.title}`,
            ``,
            `Elements (${snapshot.nodes.length}):`,
          ];

          for (const node of snapshot.nodes) {
            let line = `  ${node.ref} [${node.role}] "${node.name}"`;
            if (node.value !== undefined) line += ` value="${node.value}"`;
            if (node.focused) line += ' (focused)';
            if (node.checked) line += ' (checked)';
            if (node.disabled) line += ' (disabled)';
            if (node.description) line += ` — ${node.description}`;
            lines.push(line);
          }

          return successResponse(lines.join('\n'));
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_click
    tool(
      'browser_click',
      BROWSER_DESCRIPTIONS.browser_click,
      {
        ref: z.string().describe('Element ref from browser_snapshot (e.g., "@e1")'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          await fns.click(args.ref);
          return successResponse(`Clicked element ${args.ref}`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_fill
    tool(
      'browser_fill',
      BROWSER_DESCRIPTIONS.browser_fill,
      {
        ref: z.string().describe('Element ref from browser_snapshot (e.g., "@e5")'),
        value: z.string().describe('Text to type into the element'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          await fns.fill(args.ref, args.value);
          return successResponse(`Filled element ${args.ref} with "${args.value}"`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_select
    tool(
      'browser_select',
      BROWSER_DESCRIPTIONS.browser_select,
      {
        ref: z.string().describe('Element ref from browser_snapshot (e.g., "@e3")'),
        value: z.string().describe('Option value to select'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          await fns.select(args.ref, args.value);
          return successResponse(`Selected "${args.value}" in element ${args.ref}`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_screenshot
    tool(
      'browser_screenshot',
      BROWSER_DESCRIPTIONS.browser_screenshot,
      {
        mode: z.enum(['raw', 'agent']).optional().describe('Capture mode. raw=plain screenshot, agent=adds semantic annotations and metadata'),
        refs: z.array(z.string()).optional().describe('Element refs from browser_snapshot to annotate'),
        includeLastAction: z.boolean().optional().describe('Include last browser action target when available'),
        includeMetadata: z.boolean().optional().describe('Include compact metadata overlay and metadata payload in response text'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          const result = await fns.screenshot(args);
          const base64 = result.png.toString('base64');

          const lines = [
            `Screenshot captured (${Math.round(result.png.length / 1024)}KB PNG)`,
          ];
          if (result.metadata) {
            lines.push('', 'Metadata:', JSON.stringify(result.metadata, null, 2));
          }

          return {
            content: [
              { type: 'text' as const, text: lines.join('\n') },
              { type: 'image' as const, data: base64, mimeType: 'image/png' },
            ],
          };
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_scroll
    tool(
      'browser_scroll',
      BROWSER_DESCRIPTIONS.browser_scroll,
      {
        direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
        amount: z.number().optional().describe('Scroll amount in pixels (default: 500)'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          await fns.scroll(args.direction, args.amount);
          return successResponse(`Scrolled ${args.direction}${args.amount ? ` by ${args.amount}px` : ''}`);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_back
    tool(
      'browser_back',
      BROWSER_DESCRIPTIONS.browser_back,
      {},
      async () => {
        try {
          const fns = getBrowserFns();
          await fns.goBack();
          return successResponse('Navigated back');
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_forward
    tool(
      'browser_forward',
      BROWSER_DESCRIPTIONS.browser_forward,
      {},
      async () => {
        try {
          const fns = getBrowserFns();
          await fns.goForward();
          return successResponse('Navigated forward');
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_evaluate
    tool(
      'browser_evaluate',
      BROWSER_DESCRIPTIONS.browser_evaluate,
      {
        expression: z.string().describe('JavaScript expression to evaluate in the page context'),
      },
      async (args) => {
        try {
          const fns = getBrowserFns();
          const result = await fns.evaluate(args.expression);
          const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          return successResponse(text);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),

    // browser_tool
    tool(
      'browser_tool',
      BROWSER_DESCRIPTIONS.browser_tool,
      {
        command: z.string().describe('CLI-like browser command (e.g., "navigate https://example.com", "click @e1", "--help")'),
      },
      async (args) => {
        try {
          const output = await runBrowserCommand(args.command);
          return successResponse(output);
        } catch (error) {
          return errorResponse(error instanceof Error ? error.message : String(error));
        }
      },
    ),
  ];
}
