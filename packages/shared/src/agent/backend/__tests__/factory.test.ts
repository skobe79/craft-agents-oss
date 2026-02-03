/**
 * Tests for Agent Factory
 *
 * Verifies:
 * - Provider detection from auth type
 * - Backend creation for different providers
 * - LLM connection type mapping
 * - Available providers list
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  detectProvider,
  createBackend,
  createAgent,
  getAvailableProviders,
  isProviderAvailable,
  connectionTypeToProvider,
  connectionAuthTypeToBackendAuthType,
} from '../factory.ts';
import type { BackendConfig } from '../types.ts';
import type { Workspace } from '../../../config/storage.ts';
import type { SessionConfig as Session } from '../../../sessions/storage.ts';
import { ClaudeAgent } from '../../claude-agent.ts';
import { CodexAgent } from '../../codex-agent.ts';

// Test helpers
function createTestWorkspace(): Workspace {
  return {
    id: 'test-workspace',
    name: 'Test Workspace',
    rootPath: '/test/workspace',
    createdAt: Date.now(),
  };
}

function createTestSession(): Session {
  return {
    id: 'test-session',
    name: 'Test Session',
    workspaceRootPath: '/test/workspace',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    permissionMode: 'ask',
  };
}

function createTestConfig(overrides: Partial<BackendConfig> = {}): BackendConfig {
  return {
    provider: 'anthropic',
    workspace: createTestWorkspace(),
    session: createTestSession(),
    isHeadless: true, // Prevent config watchers from starting
    ...overrides,
  };
}

describe('detectProvider', () => {
  describe('Anthropic authentication types', () => {
    it('should return anthropic for api_key', () => {
      expect(detectProvider('api_key')).toBe('anthropic');
    });

    it('should return anthropic for oauth_token', () => {
      expect(detectProvider('oauth_token')).toBe('anthropic');
    });
  });

  describe('OpenAI/Codex authentication types', () => {
    it('should return openai for codex_oauth', () => {
      expect(detectProvider('codex_oauth')).toBe('openai');
    });
  });

  describe('Unknown authentication types', () => {
    it('should default to anthropic for unknown types', () => {
      expect(detectProvider('unknown')).toBe('anthropic');
      expect(detectProvider('')).toBe('anthropic');
    });
  });
});

describe('createBackend / createAgent', () => {
  describe('Anthropic provider', () => {
    it('should create ClaudeAgent for anthropic provider', () => {
      const config = createTestConfig({ provider: 'anthropic' });
      const agent = createBackend(config);

      expect(agent).toBeInstanceOf(ClaudeAgent);
      expect(agent.capabilities().provider).toBe('anthropic');
    });
  });

  describe('OpenAI provider', () => {
    it('should create CodexAgent for openai provider', () => {
      const config = createTestConfig({ provider: 'openai' });
      const agent = createBackend(config);

      expect(agent).toBeInstanceOf(CodexAgent);
      expect(agent.capabilities().provider).toBe('openai');
    });
  });

  describe('Unknown provider', () => {
    it('should throw for unknown provider', () => {
      const config = createTestConfig({ provider: 'unknown' as any });

      expect(() => createBackend(config)).toThrow('Unknown provider: unknown');
    });
  });

  describe('createAgent alias', () => {
    it('should be an alias for createBackend', () => {
      expect(createAgent).toBe(createBackend);
    });
  });
});

describe('getAvailableProviders', () => {
  it('should return anthropic and openai', () => {
    const providers = getAvailableProviders();

    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toHaveLength(2);
  });
});

describe('isProviderAvailable', () => {
  it('should return true for anthropic', () => {
    expect(isProviderAvailable('anthropic')).toBe(true);
  });

  it('should return true for openai', () => {
    expect(isProviderAvailable('openai')).toBe(true);
  });

  it('should return false for unknown provider', () => {
    expect(isProviderAvailable('unknown' as any)).toBe(false);
  });
});

describe('connectionTypeToProvider', () => {
  it('should map anthropic type to anthropic provider', () => {
    expect(connectionTypeToProvider('anthropic')).toBe('anthropic');
  });

  it('should map openai type to openai provider', () => {
    expect(connectionTypeToProvider('openai')).toBe('openai');
  });

  it('should map openai-compat type to openai provider', () => {
    expect(connectionTypeToProvider('openai-compat')).toBe('openai');
  });

  it('should default to anthropic for unknown types', () => {
    expect(connectionTypeToProvider('unknown' as any)).toBe('anthropic');
  });
});

describe('connectionAuthTypeToBackendAuthType', () => {
  it('should map api_key to api_key', () => {
    expect(connectionAuthTypeToBackendAuthType('api_key')).toBe('api_key');
  });

  it('should map oauth to oauth_token', () => {
    expect(connectionAuthTypeToBackendAuthType('oauth')).toBe('oauth_token');
  });

  it('should map codex_oauth to codex_oauth', () => {
    expect(connectionAuthTypeToBackendAuthType('codex_oauth')).toBe('codex_oauth');
  });

  it('should map none to undefined', () => {
    expect(connectionAuthTypeToBackendAuthType('none')).toBeUndefined();
  });
});

describe('Agent capabilities', () => {
  it('ClaudeAgent should report correct capabilities', () => {
    const config = createTestConfig({ provider: 'anthropic' });
    const agent = createBackend(config);
    const caps = agent.capabilities();

    expect(caps.provider).toBe('anthropic');
    expect(caps.supportsPermissionCallbacks).toBe(true);
    expect(caps.supportsMcp).toBe(true);
    expect(caps.supportsResume).toBe(true);
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.thinkingLevels.length).toBeGreaterThan(0);
  });

  it('CodexAgent should report correct capabilities', () => {
    const config = createTestConfig({ provider: 'openai' });
    const agent = createBackend(config);
    const caps = agent.capabilities();

    expect(caps.provider).toBe('openai');
    expect(caps.supportsPermissionCallbacks).toBe(true);
    expect(caps.supportsMcp).toBe(true);
    expect(caps.supportsResume).toBe(true);
    expect(caps.models.length).toBeGreaterThan(0);
    expect(caps.thinkingLevels.length).toBeGreaterThan(0);
  });
});
