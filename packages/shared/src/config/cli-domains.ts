export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'arch-agentz label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'arch-agentz label list',
      'arch-agentz label create --name "Bug" --color "accent"',
      'arch-agentz label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'arch-agentz source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'arch-agentz source list',
      'arch-agentz source get <slug>',
      'arch-agentz source update <slug> --json "{...}"',
      'arch-agentz source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'arch-agentz skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'arch-agentz skill list',
      'arch-agentz skill get <slug>',
      'arch-agentz skill update <slug> --json "{...}"',
      'arch-agentz skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'arch-agentz automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'arch-agentz automation list',
      'arch-agentz automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'arch-agentz automation update <id> --json "{\"enabled\":false}"',
      'arch-agentz automation history <id> --limit 20',
      'arch-agentz automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'arch-agentz permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'arch-agentz permission list',
      'arch-agentz permission get --source linear',
      'arch-agentz permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'arch-agentz permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'arch-agentz theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'arch-agentz theme get',
      'arch-agentz theme list-presets',
      'arch-agentz theme set-color-theme nord',
      'arch-agentz theme set-workspace-color-theme default',
      'arch-agentz theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by arch-agentz CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const ARCH_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const ARCH_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)

/**
 * Namespace-aware workspace scope entries for arch-agentz CLI owned paths.
 */
export const ARCH_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))

/**
 * Namespace-aware Bash guard scope entries.
 */
export const ARCH_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only arch-agentz bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getCraftAgentReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^arch-agentz\\s+${namespace}\\s+(${actions})\\b`,
      comment: `arch-agentz ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^arch-agentz\\s*$', comment: 'arch-agentz bare invocation (prints help)' },
    { pattern: `^arch-agentz\\s+(${namespaceAlternation})\\s*$`, comment: 'arch-agentz entity help' },
    { pattern: `^arch-agentz\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'arch-agentz entity help flags' },
    { pattern: '^arch-agentz\\s+--(help|version|discover)\\b', comment: 'arch-agentz global flags' },
  )

  return rules
}

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
