/**
 * Hooks Atom
 *
 * Simple atom for storing parsed workspace hooks.
 * AppShell populates this when hooks.json is loaded from the workspace root.
 * MainContentPanel reads from it for task detail display.
 */

import { atom } from 'jotai'
import type { HookListItem } from '../components/hooks/types'

/**
 * Atom to store the current workspace's parsed hooks.
 * AppShell loads hooks.json, parses via parseHooksConfig(), and sets this atom.
 */
export const hooksAtom = atom<HookListItem[]>([])
