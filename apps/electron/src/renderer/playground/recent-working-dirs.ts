export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/arch-agentz',
    '/Users/demo/projects/arch-agentz/apps/electron',
    '/Users/demo/projects/arch-agentz/packages/shared',
  ],
  many: [
    '/Users/demo/projects/arch-agentz',
    '/Users/demo/projects/arch-agentz/apps/electron',
    '/Users/demo/projects/arch-agentz/apps/viewer',
    '/Users/demo/projects/arch-agentz/apps/cli',
    '/Users/demo/projects/arch-agentz/packages/shared',
    '/Users/demo/projects/arch-agentz/packages/server-core',
    '/Users/demo/projects/arch-agentz/packages/pi-agent-server',
    '/Users/demo/projects/arch-agentz/packages/ui',
    '/Users/demo/projects/arch-agentz/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
