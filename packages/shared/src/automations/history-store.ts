/**
 * History Store — single source of truth for automations-history.jsonl writes.
 *
 * Provides:
 * - `appendAutomationHistoryEntry()` — serialized append with periodic compaction
 * - `compactAutomationHistory()` — two-tier retention: per-automation + global cap
 *
 * All history writes across the codebase should go through `appendAutomationHistoryEntry`
 * so retention is enforced uniformly (prompt actions, webhooks, retries, test/replay).
 */

import { appendFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'path';
import { createLogger } from '../utils/debug.ts';
import {
  AUTOMATIONS_HISTORY_FILE,
  AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER,
  AUTOMATION_HISTORY_MAX_ENTRIES,
} from './constants.ts';

const log = createLogger('history-store');

// ============================================================================
// Per-workspace mutex — serializes read-modify-write to avoid races
// ============================================================================

const mutexes = new Map<string, Promise<void>>();

function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexes.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  mutexes.set(key, next.then(() => {}, () => {}));
  return next;
}

// ============================================================================
// Append
// ============================================================================

/** Counter per workspace — triggers compaction every N appends. */
const appendCounters = new Map<string, number>();
const COMPACT_EVERY = 50;

/**
 * Append a history entry and periodically compact the file.
 *
 * The entry must already be a fully-formed history object (use `createWebhookHistoryEntry`
 * or `createPromptHistoryEntry` from `webhook-utils.ts` to build one).
 */
export async function appendAutomationHistoryEntry(
  workspaceRootPath: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const historyPath = join(workspaceRootPath, AUTOMATIONS_HISTORY_FILE);

  await withMutex(workspaceRootPath, async () => {
    await appendFile(historyPath, JSON.stringify(entry) + '\n', 'utf-8');

    const count = (appendCounters.get(workspaceRootPath) ?? 0) + 1;
    appendCounters.set(workspaceRootPath, count);

    if (count >= COMPACT_EVERY) {
      appendCounters.set(workspaceRootPath, 0);
      await runCompaction(historyPath);
    }
  });
}

// ============================================================================
// Compaction
// ============================================================================

/**
 * Compact the history file in-place: enforce per-automation and global caps.
 *
 * Call this on startup to migrate legacy files, or let `appendAutomationHistoryEntry`
 * trigger it periodically.
 */
export async function compactAutomationHistory(
  workspaceRootPath: string,
  maxPerMatcher: number = AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER,
  maxTotal: number = AUTOMATION_HISTORY_MAX_ENTRIES,
): Promise<void> {
  const historyPath = join(workspaceRootPath, AUTOMATIONS_HISTORY_FILE);

  await withMutex(workspaceRootPath, () => runCompaction(historyPath, maxPerMatcher, maxTotal));
}

/**
 * Internal compaction — must be called inside withMutex.
 */
async function runCompaction(
  historyPath: string,
  maxPerMatcher: number = AUTOMATION_HISTORY_MAX_RUNS_PER_MATCHER,
  maxTotal: number = AUTOMATION_HISTORY_MAX_ENTRIES,
): Promise<void> {
  let content: string;
  try {
    if (!existsSync(historyPath)) return;
    content = await readFile(historyPath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return;

  // Parse all lines, dropping malformed ones
  const entries: Array<{ raw: string; id: string }> = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      entries.push({ raw: line, id: parsed.id ?? '' });
    } catch {
      // Drop malformed lines
    }
  }

  // Track original line count (including malformed) for dirty-check
  const originalLineCount = lines.length;

  // 1) Per-automation cap: keep only last N per ID (iterate in order, slice per group)
  const byId = new Map<string, number[]>(); // id → indices
  for (let i = 0; i < entries.length; i++) {
    const id = entries[i]!.id;
    let group = byId.get(id);
    if (!group) {
      group = [];
      byId.set(id, group);
    }
    group.push(i);
  }

  const keepIndices = new Set<number>();
  for (const indices of byId.values()) {
    const kept = indices.slice(-maxPerMatcher);
    for (const idx of kept) {
      keepIndices.add(idx);
    }
  }

  let trimmed = entries.filter((_, i) => keepIndices.has(i));

  // 2) Global cap: if still over limit, drop oldest globally
  if (trimmed.length > maxTotal) {
    trimmed = trimmed.slice(-maxTotal);
  }

  if (trimmed.length === originalLineCount) return; // nothing to trim

  const output = trimmed.map(e => e.raw).join('\n') + '\n';
  await writeFile(historyPath, output, 'utf-8');
  log.debug(`[HistoryStore] Compacted: ${originalLineCount} → ${trimmed.length} entries`);
}
