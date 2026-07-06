/**
 * Centralized path configuration for Craft Agent.
 *
 * Supports multi-instance development via ARCH_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., craft-tui-agent-1), the detect-instance.sh
 * script sets ARCH_CONFIG_DIR to ~/.arch-agentz-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.arch-agentz/
 * Instance 1 (-1 suffix): ~/.arch-agentz-1/
 * Instance 2 (-2 suffix): ~/.arch-agentz-2/
 */

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, cpSync } from 'fs';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.arch-agentz/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.ARCH_CONFIG_DIR || join(homedir(), '.arch-agentz');

// One-time migration from .craft-agent to .arch-agentz
const oldConfigDir = join(homedir(), '.craft-agent');
if (!process.env.ARCH_CONFIG_DIR && !existsSync(CONFIG_DIR) && existsSync(oldConfigDir)) {
  try {
    cpSync(oldConfigDir, CONFIG_DIR, { recursive: true });
    console.log(`[Migration] Copied configuration from ${oldConfigDir} to ${CONFIG_DIR}`);
  } catch (err) {
    console.error(`[Migration] Failed to copy config from ${oldConfigDir} to ${CONFIG_DIR}:`, err);
  }
}
