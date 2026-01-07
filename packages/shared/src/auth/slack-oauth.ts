/**
 * Slack OAuth flow using Slack's OAuth 2.0 v2
 *
 * This module handles the complete Slack OAuth flow:
 * 1. Opens browser for Slack consent screen
 * 2. Receives authorization code via local callback server
 * 3. Exchanges code for access and refresh tokens
 * 4. Returns tokens and workspace info
 *
 * Supports multiple service presets (messaging, channels, users, files, full)
 * or custom bot/user scopes for other use cases.
 */

import { URL } from 'url';
import open from 'open';
import { randomBytes } from 'crypto';
import { createCallbackServer, type AppType } from './callback-server.ts';

/**
 * Slack service types for scope selection
 */
export type SlackService = 'messaging' | 'channels' | 'users' | 'files' | 'full';

// Slack OAuth configuration - must be set via environment variables
// These are baked into the build at compile time
const SLACK_CLIENT_ID = process.env.SLACK_OAUTH_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_OAUTH_CLIENT_SECRET || '';

// Slack OAuth endpoints
const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

/**
 * Predefined scope sets for common Slack services
 * Bot scopes are used by default; user scopes are optional for specific use cases
 */
export const SLACK_SERVICE_SCOPES: Record<SlackService, { bot: string[]; user?: string[] }> = {
  messaging: {
    bot: ['chat:write', 'chat:write.public', 'im:write'],
  },
  channels: {
    bot: ['channels:read', 'channels:history', 'groups:read', 'groups:history'],
  },
  users: {
    bot: ['users:read', 'users:read.email'],
  },
  files: {
    bot: ['files:read', 'files:write'],
  },
  full: {
    bot: [
      'chat:write',
      'chat:write.public',
      'im:write',
      'channels:read',
      'channels:history',
      'groups:read',
      'groups:history',
      'users:read',
      'users:read.email',
      'files:read',
      'files:write',
      'reactions:read',
      'reactions:write',
    ],
  },
};

/**
 * Options for starting Slack OAuth flow
 */
export interface SlackOAuthOptions {
  /** Slack service to authenticate (uses predefined scopes) */
  service?: SlackService;
  /** Custom bot scopes (overrides service scopes if provided) */
  botScopes?: string[];
  /** Custom user scopes (optional, for user-specific actions) */
  userScopes?: string[];
  /** App type for callback server styling */
  appType?: AppType;
}

/**
 * Result of Slack OAuth flow
 */
export interface SlackOAuthResult {
  success: boolean;
  /** Bot access token (xoxb-...) */
  accessToken?: string;
  /** Refresh token for token rotation */
  refreshToken?: string;
  /** Token expiration timestamp (ms) */
  expiresAt?: number;
  /** Slack workspace ID */
  teamId?: string;
  /** Slack workspace name */
  teamName?: string;
  /** Bot user ID in the workspace */
  botUserId?: string;
  /** User access token (xoxp-...) if user_scope was requested */
  userAccessToken?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Generate random state for CSRF protection
 */
function generateState(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Exchange authorization code for tokens
 * Slack uses HTTP Basic auth for token exchange
 */
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  teamId: string;
  teamName: string;
  botUserId?: string;
  userAccessToken?: string;
}> {
  // Use HTTP Basic auth as recommended by Slack
  const authHeader = Buffer.from(`${SLACK_CLIENT_ID}:${SLACK_CLIENT_SECRET}`).toString('base64');

  const params = new URLSearchParams({
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`,
    },
    body: params.toString(),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    team?: { id: string; name: string };
    bot_user_id?: string;
    authed_user?: { id: string; access_token?: string };
  };

  if (!data.ok) {
    throw new Error(`Slack token exchange failed: ${data.error || 'Unknown error'}`);
  }

  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    teamId: data.team?.id || '',
    teamName: data.team?.name || '',
    botUserId: data.bot_user_id,
    userAccessToken: data.authed_user?.access_token,
  };
}

/**
 * Refresh Slack access token using refresh token
 */
export async function refreshSlackToken(
  refreshToken: string,
  clientId?: string
): Promise<{ accessToken: string; expiresAt?: number }> {
  const authHeader = Buffer.from(
    `${clientId || SLACK_CLIENT_ID}:${SLACK_CLIENT_SECRET}`
  ).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`,
    },
    body: params.toString(),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    expires_in?: number;
  };

  if (!data.ok) {
    throw new Error(`Failed to refresh Slack token: ${data.error}`);
  }

  return {
    accessToken: data.access_token!,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

/**
 * Check if Slack OAuth is configured (client ID and secret are set)
 */
export function isSlackOAuthConfigured(): boolean {
  return Boolean(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET);
}

/**
 * Get scopes for a Slack service or use custom scopes
 */
export function getSlackScopes(options: SlackOAuthOptions): { bot: string[]; user: string[] } {
  // Custom scopes take precedence
  if (options.botScopes && options.botScopes.length > 0) {
    return { bot: options.botScopes, user: options.userScopes || [] };
  }

  // Use predefined service scopes
  if (options.service && options.service in SLACK_SERVICE_SCOPES) {
    const scopes = SLACK_SERVICE_SCOPES[options.service];
    return { bot: scopes.bot, user: scopes.user || [] };
  }

  // Default to full workspace scopes
  return { bot: SLACK_SERVICE_SCOPES.full.bot, user: [] };
}

/**
 * Start Slack OAuth flow
 *
 * Opens browser for Slack consent, handles callback, and returns tokens + workspace info.
 * Supports multiple Slack services via the service option, or custom scopes.
 *
 * @example
 * // Authenticate with full workspace access
 * const result = await startSlackOAuth({ service: 'full' });
 *
 * @example
 * // Authenticate for messaging only
 * const result = await startSlackOAuth({ service: 'messaging' });
 *
 * @example
 * // Authenticate with custom scopes
 * const result = await startSlackOAuth({
 *   botScopes: ['chat:write', 'users:read']
 * });
 */
export async function startSlackOAuth(options: SlackOAuthOptions = {}): Promise<SlackOAuthResult> {
  try {
    // Verify OAuth credentials are configured
    if (!isSlackOAuthConfigured()) {
      return {
        success: false,
        error:
          'Slack OAuth not configured. Set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET environment variables.',
      };
    }

    // Get scopes for this request
    const scopes = getSlackScopes(options);

    // Generate state for CSRF protection
    const state = generateState();

    // Start callback server (Slack requires HTTPS for redirect URIs)
    const appType = options.appType || 'electron';
    const callbackServer = await createCallbackServer({ appType, useHttps: true });
    const redirectUri = `${callbackServer.url}/callback`;

    // Build authorization URL
    const authUrl = new URL(SLACK_AUTH_URL);
    authUrl.searchParams.set('client_id', SLACK_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', scopes.bot.join(','));

    // Add user scopes if provided
    if (scopes.user.length > 0) {
      authUrl.searchParams.set('user_scope', scopes.user.join(','));
    }

    // Open browser for authorization
    await open(authUrl.toString());

    // Wait for callback
    const callback = await callbackServer.promise;

    // Verify state
    if (callback.query.state !== state) {
      return {
        success: false,
        error: 'OAuth state mismatch - possible CSRF attack',
      };
    }

    // Check for error
    if (callback.query.error) {
      return {
        success: false,
        error: callback.query.error_description || callback.query.error,
      };
    }

    // Get authorization code
    const code = callback.query.code;
    if (!code) {
      return {
        success: false,
        error: 'No authorization code received',
      };
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
      teamId: tokens.teamId,
      teamName: tokens.teamName,
      botUserId: tokens.botUserId,
      userAccessToken: tokens.userAccessToken,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Slack OAuth',
    };
  }
}
