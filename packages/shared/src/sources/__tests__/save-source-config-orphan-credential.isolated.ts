/**
 * Regression: saveSourceConfig should clean up orphan credentials when an API
 * source is set to authType:'none'.
 *
 * Background: getCredentialId() maps 'none', 'header', and 'query' authTypes to
 * the same source_apikey slot. Flipping a source from 'header' to 'none' leaves
 * the original credential value addressable under the source's slot, which can
 * silently override defaultHeaders on subsequent server builds.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type DeletedCredentialId = { type: string; workspaceId: string; sourceId: string };

let deleteCalls: DeletedCredentialId[] = [];
let deleteShouldThrow = false;
let deleteReturnValue = true;

// Mock at the lowest level — `getCredentialManager` from credentials/index.ts.
// Other test files in this directory mock this same module; the most recently
// registered factory wins, so re-registering here is what we want.
mock.module('../../credentials/index.ts', () => ({
  getCredentialManager: () => ({
    get: async () => null,
    set: async () => undefined,
    delete: async (id: DeletedCredentialId) => {
      deleteCalls.push(id);
      if (deleteShouldThrow) throw new Error('encrypted store unavailable');
      return deleteReturnValue;
    },
  }),
  CredentialManager: class {},
  SOURCE_CREDENTIAL_TYPES: [
    'source_oauth',
    'source_bearer',
    'source_basic',
    'source_apikey',
  ],
  credentialIdToAccount: (id: DeletedCredentialId) =>
    `${id.type}::${id.workspaceId}::${id.sourceId}`,
  accountToCredentialId: () => null,
}));

const { saveSourceConfig, loadSourceConfig } = await import('../storage.ts');
import type { FolderSourceConfig } from '../types.ts';

let workspaceRoot: string;

beforeEach(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'save-source-config-orphan-'));
  deleteCalls = [];
  deleteShouldThrow = false;
  deleteReturnValue = true;
});

afterEach(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

function apiConfig(overrides: Partial<FolderSourceConfig['api']> = {}): FolderSourceConfig {
  return {
    id: 'picnic_abcd',
    name: 'Picnic',
    slug: 'picnic',
    enabled: true,
    provider: 'custom',
    type: 'api',
    api: {
      baseUrl: 'https://example.com',
      authType: 'none',
      ...overrides,
    },
  };
}

describe('saveSourceConfig orphan credential cleanup', () => {
  test("deletes the source_apikey slot when an API source is saved with authType:'none'", () => {
    saveSourceConfig(workspaceRoot, apiConfig({
      authType: 'none',
      defaultHeaders: { Cookie: '_oauth2_proxy=foo; __cf_bm=bar' },
    }));

    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0]!.type).toBe('source_apikey');
    expect(deleteCalls[0]!.sourceId).toBe('picnic');
    expect(deleteCalls[0]!.workspaceId).toMatch(/^save-source-config-orphan-/);
  });

  test("does NOT delete the credential when API source is saved with authType:'header'", () => {
    saveSourceConfig(workspaceRoot, apiConfig({ authType: 'header', headerName: 'Cookie' }));
    expect(deleteCalls).toHaveLength(0);
  });

  test("does NOT delete the credential when API source is saved with authType:'bearer'", () => {
    saveSourceConfig(workspaceRoot, apiConfig({ authType: 'bearer' }));
    expect(deleteCalls).toHaveLength(0);
  });

  test("does NOT delete the credential for MCP sources with mcp.authType:'none'", () => {
    const config: FolderSourceConfig = {
      id: 'mcp_abcd',
      name: 'Some MCP',
      slug: 'some-mcp',
      enabled: true,
      provider: 'custom',
      type: 'mcp',
      mcp: { transport: 'http', url: 'https://example.com/mcp', authType: 'none' },
    };

    saveSourceConfig(workspaceRoot, config);

    expect(deleteCalls).toHaveLength(0);
  });

  test("saving authType:'none' when nothing is stored is a safe no-op", () => {
    deleteReturnValue = false; // simulate "nothing to delete"
    expect(() => saveSourceConfig(workspaceRoot, apiConfig({ authType: 'none' }))).not.toThrow();
    expect(deleteCalls).toHaveLength(1); // attempt made; backend reports no-op
  });

  test('credential delete failure does NOT prevent the config file from being written', () => {
    deleteShouldThrow = true;

    expect(() => saveSourceConfig(workspaceRoot, apiConfig({ authType: 'none' }))).not.toThrow();

    const loaded = loadSourceConfig(workspaceRoot, 'picnic');
    expect(loaded?.api?.authType).toBe('none');
    expect(existsSync(join(workspaceRoot, 'sources', 'picnic', 'config.json'))).toBe(true);
  });
});
