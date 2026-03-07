/**
 * WebhookHandler - Processes webhook actions for App events
 *
 * Subscribes to App events and executes HTTP webhook requests.
 * Sends requests to configured HTTP/HTTPS endpoints with configurable
 * method, headers, and body format (JSON or raw).
 */

import { createLogger } from '../../utils/debug.ts';
import type { EventBus, BaseEventPayload } from '../event-bus.ts';
import type { AutomationHandler, AutomationsConfigProvider } from './types.ts';
import { APP_EVENTS, type AutomationEvent, type WebhookAction, type WebhookActionResult, type AppEvent } from '../types.ts';
import { matcherMatches, buildEnvFromPayload, expandEnvVars } from '../utils.ts';

const log = createLogger('webhook-handler');

// ============================================================================
// Types
// ============================================================================

export interface WebhookHandlerOptions {
  /** Workspace ID */
  workspaceId: string;
  /** Workspace root path */
  workspaceRootPath: string;
  /** Called when webhook results are available */
  onWebhookResults?: (results: WebhookActionResult[]) => void;
  /** Called when a webhook execution fails */
  onError?: (event: AutomationEvent, error: Error) => void;
}

// ============================================================================
// WebhookHandler Implementation
// ============================================================================

export class WebhookHandler implements AutomationHandler {
  private readonly options: WebhookHandlerOptions;
  private readonly configProvider: AutomationsConfigProvider;
  private bus: EventBus | null = null;
  private boundHandler: ((event: AutomationEvent, payload: BaseEventPayload) => Promise<void>) | null = null;

  constructor(options: WebhookHandlerOptions, configProvider: AutomationsConfigProvider) {
    this.options = options;
    this.configProvider = configProvider;
  }

  /**
   * Subscribe to App events on the bus.
   */
  subscribe(bus: EventBus): void {
    this.bus = bus;
    this.boundHandler = this.handleEvent.bind(this);
    bus.onAny(this.boundHandler);
    log.debug(`[WebhookHandler] Subscribed to event bus`);
  }

  /**
   * Handle an event by processing matching webhook actions.
   */
  private async handleEvent(event: AutomationEvent, payload: BaseEventPayload): Promise<void> {
    // Only process App events for webhook actions
    if (!APP_EVENTS.includes(event as AppEvent)) {
      return;
    }

    const matchers = this.configProvider.getMatchersForEvent(event);
    if (matchers.length === 0) return;

    // Collect webhook actions from matching matchers
    const webhookActions: WebhookAction[] = [];

    for (const matcher of matchers) {
      if (!matcherMatches(matcher, event, payload as unknown as Record<string, unknown>)) continue;

      for (const action of matcher.actions) {
        if (action.type === 'webhook') {
          webhookActions.push(action);
        }
      }
    }

    if (webhookActions.length === 0) return;

    log.debug(`[WebhookHandler] Processing ${webhookActions.length} webhooks for ${event}`);

    // Build environment variables for URL/body expansion
    const env = buildEnvFromPayload(event, payload);

    // Execute webhook requests
    const results: WebhookActionResult[] = [];

    for (const action of webhookActions) {
      const result = await this.executeWebhook(action, env);
      results.push(result);
    }

    // Deliver results via callback
    if (results.length > 0 && this.options.onWebhookResults) {
      log.debug(`[WebhookHandler] Delivering ${results.length} webhook results`);
      this.options.onWebhookResults(results);
    }
  }

  /**
   * Execute a single webhook request.
   */
  private async executeWebhook(
    action: WebhookAction,
    env: Record<string, string>
  ): Promise<WebhookActionResult> {
    const method = action.method ?? 'POST';
    const url = expandEnvVars(action.url, env);

    try {
      // Build headers
      const headers: Record<string, string> = {};
      if (action.headers) {
        for (const [key, value] of Object.entries(action.headers)) {
          headers[key] = expandEnvVars(value, env);
        }
      }

      // Build body
      let requestBody: string | undefined;
      if (method !== 'GET' && action.body !== undefined) {
        const bodyFormat = action.bodyFormat ?? 'json';

        if (bodyFormat === 'json') {
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
          }
          if (typeof action.body === 'string') {
            requestBody = expandEnvVars(action.body, env);
          } else {
            // For objects, stringify and expand env vars in the result
            requestBody = expandEnvVars(JSON.stringify(action.body), env);
          }
        } else {
          // Raw body
          requestBody = expandEnvVars(String(action.body), env);
        }
      }

      log.debug(`[WebhookHandler] ${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
      });

      const success = response.status >= 200 && response.status < 300;

      if (!success) {
        log.debug(`[WebhookHandler] ${method} ${url} → ${response.status}`);
      }

      return {
        type: 'webhook',
        url,
        statusCode: response.status,
        success,
        error: success ? undefined : `HTTP ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      log.debug(`[WebhookHandler] ${method} ${url} → error: ${error}`);

      return {
        type: 'webhook',
        url,
        statusCode: 0,
        success: false,
        error,
      };
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.bus && this.boundHandler) {
      this.bus.offAny(this.boundHandler);
      this.boundHandler = null;
    }
    this.bus = null;
    log.debug(`[WebhookHandler] Disposed`);
  }
}
