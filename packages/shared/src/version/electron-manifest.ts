/**
 * Electron-specific manifest fetching
 *
 * Uses the /electron/ path prefix for Electron app updates.
 * Endpoints:
 * - https://agents.craft.do/electron/latest
 * - https://agents.craft.do/electron/{version}/manifest.json
 */

import { debug } from '../utils/debug';
import type { VersionManifest } from './manifest';

const ELECTRON_VERSIONS_URL = 'https://agents.craft.do/electron';

/**
 * Fetch the latest Electron app version from the server
 */
export async function getElectronLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(`${ELECTRON_VERSIONS_URL}/latest`);
    if (!response.ok) {
      debug(`[electron-manifest] Failed to fetch latest version: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const version = (data as { version?: string }).version;
    if (typeof version !== 'string') {
      debug('[electron-manifest] Latest version is not a valid string');
      return null;
    }
    return version;
  } catch (error) {
    debug(`[electron-manifest] Failed to get latest version: ${error}`);
    return null;
  }
}

/**
 * Fetch the manifest for a specific Electron app version
 */
export async function getElectronManifest(version: string): Promise<VersionManifest | null> {
  try {
    const url = `${ELECTRON_VERSIONS_URL}/${version}/manifest.json`;
    debug(`[electron-manifest] Getting manifest for version: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      debug(`[electron-manifest] Failed to fetch manifest: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data as VersionManifest;
  } catch (error) {
    debug(`[electron-manifest] Failed to get manifest: ${error}`);
    return null;
  }
}

/**
 * Compare two semver version strings
 * Returns true if `latest` is newer than `current`
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parseVersion = (v: string): number[] => {
    return v.split('.').map(n => parseInt(n, 10) || 0);
  };

  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);

  // Pad shorter array with zeros
  const maxLen = Math.max(currentParts.length, latestParts.length);
  while (currentParts.length < maxLen) currentParts.push(0);
  while (latestParts.length < maxLen) latestParts.push(0);

  for (let i = 0; i < maxLen; i++) {
    if (latestParts[i] > currentParts[i]) return true;
    if (latestParts[i] < currentParts[i]) return false;
  }

  return false; // Equal versions
}

/**
 * Get the platform key for the current system (darwin-arm64, darwin-x64, etc.)
 */
export function getPlatformKey(): string {
  const platform = process.platform;
  const arch = process.arch;
  return `${platform}-${arch}`;
}
