import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { permissionsConfigCache } from '../permissions-config.ts'

const originalConfigDir = process.env.ARCH_CONFIG_DIR
const originalCliFlag = process.env.ARCH_FEATURE_ARCH_AGENTS_CLI

function writeDefaultPermissions(configDir: string) {
  const permissionsDir = join(configDir, 'permissions')
  mkdirSync(permissionsDir, { recursive: true })
  writeFileSync(
    join(permissionsDir, 'default.json'),
    JSON.stringify(
      {
        version: '2026-03-07',
        allowedBashPatterns: [
          { pattern: '^arch-agentz\\s+label\\s+list\\b', comment: 'arch-agentz label read-only operations' },
          { pattern: '^rg\\b', comment: 'Ripgrep search' },
        ],
        allowedMcpPatterns: [],
        allowedApiEndpoints: [],
        allowedWritePaths: [],
        blockedCommandHints: [],
      },
      null,
      2,
    ),
  )
}

beforeEach(() => {
  permissionsConfigCache.clear()
})

afterEach(() => {
  permissionsConfigCache.clear()

  if (originalConfigDir === undefined) delete process.env.ARCH_CONFIG_DIR
  else process.env.ARCH_CONFIG_DIR = originalConfigDir

  if (originalCliFlag === undefined) delete process.env.ARCH_FEATURE_ARCH_AGENTS_CLI
  else process.env.ARCH_FEATURE_ARCH_AGENTS_CLI = originalCliFlag
})

describe('permissions config arch-agentzs-cli feature flag', () => {
  it('skips compiling arch-agentz bash allowlist patterns when feature is disabled', () => {
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'craft-permissions-'))
    try {
      process.env.ARCH_CONFIG_DIR = tempConfigDir
      process.env.ARCH_FEATURE_ARCH_AGENTS_CLI = '0'
      writeDefaultPermissions(tempConfigDir)

      const merged = permissionsConfigCache.getMergedConfig({
        workspaceRootPath: '/tmp/workspace',
        activeSourceSlugs: [],
      })

      const sources = merged.readOnlyBashPatterns.map(p => p.source)
      expect(sources.some(source => source.startsWith('^arch-agentz\\s'))).toBe(false)
      expect(sources).toContain('^rg\\b')
    } finally {
      rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })

  it('compiles arch-agentz bash allowlist patterns when feature is enabled', () => {
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'craft-permissions-'))
    try {
      process.env.ARCH_CONFIG_DIR = tempConfigDir
      process.env.ARCH_FEATURE_ARCH_AGENTS_CLI = '1'
      writeDefaultPermissions(tempConfigDir)

      const merged = permissionsConfigCache.getMergedConfig({
        workspaceRootPath: '/tmp/workspace',
        activeSourceSlugs: [],
      })

      const sources = merged.readOnlyBashPatterns.map(p => p.source)
      expect(sources).toContain('^arch-agentz\\s+label\\s+list\\b')
      expect(sources).toContain('^rg\\b')
    } finally {
      rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })
})
