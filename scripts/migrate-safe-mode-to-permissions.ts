#!/usr/bin/env bun
/**
 * Migration Script: Rename safe-mode.json to permissions.json
 *
 * This script finds all safe-mode.json files in the ~/.craft-agent directory
 * and renames them to permissions.json.
 *
 * Locations:
 * - ~/.craft-agent/workspaces/{slug}/safe-mode.json
 * - ~/.craft-agent/workspaces/{slug}/sources/{sourceSlug}/safe-mode.json
 */

import { readdirSync, renameSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CRAFT_AGENT_DIR = join(homedir(), '.craft-agent');
const WORKSPACES_DIR = join(CRAFT_AGENT_DIR, 'workspaces');

interface MigrationResult {
  renamed: string[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Recursively find all safe-mode.json files in a directory
 */
function findSafeModeFiles(dir: string): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    try {
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recurse into subdirectories
        results.push(...findSafeModeFiles(fullPath));
      } else if (entry === 'safe-mode.json') {
        // Found a safe-mode.json file
        results.push(fullPath);
      }
    } catch (err) {
      console.warn(`Warning: Could not access ${fullPath}:`, err);
    }
  }

  return results;
}

/**
 * Rename safe-mode.json to permissions.json
 */
function migrateSafeModeFile(filePath: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  const newPath = join(dir, 'permissions.json');

  // Check if permissions.json already exists
  if (existsSync(newPath)) {
    throw new Error(`permissions.json already exists at ${newPath}`);
  }

  // Rename the file
  renameSync(filePath, newPath);
  console.log(`✓ Renamed: ${filePath} → ${newPath}`);
}

/**
 * Main migration function
 */
function migrate(): MigrationResult {
  const result: MigrationResult = {
    renamed: [],
    errors: [],
  };

  console.log('🔍 Searching for safe-mode.json files in:', WORKSPACES_DIR);
  console.log();

  if (!existsSync(WORKSPACES_DIR)) {
    console.log('No workspaces directory found. Nothing to migrate.');
    return result;
  }

  const safeModeFiles = findSafeModeFiles(WORKSPACES_DIR);

  if (safeModeFiles.length === 0) {
    console.log('No safe-mode.json files found. Nothing to migrate.');
    return result;
  }

  console.log(`Found ${safeModeFiles.length} safe-mode.json file(s):`);
  safeModeFiles.forEach(file => console.log(`  - ${file}`));
  console.log();

  console.log('🔄 Migrating files...');
  console.log();

  for (const file of safeModeFiles) {
    try {
      migrateSafeModeFile(file);
      result.renamed.push(file);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`✗ Failed to rename ${file}:`, errorMsg);
      result.errors.push({ file, error: errorMsg });
    }
  }

  return result;
}

// Run migration
console.log('='.repeat(60));
console.log('Migration: safe-mode.json → permissions.json');
console.log('='.repeat(60));
console.log();

const result = migrate();

console.log();
console.log('='.repeat(60));
console.log('Migration Summary');
console.log('='.repeat(60));
console.log(`✓ Successfully renamed: ${result.renamed.length} file(s)`);
console.log(`✗ Errors: ${result.errors.length} file(s)`);

if (result.errors.length > 0) {
  console.log();
  console.log('Errors:');
  result.errors.forEach(({ file, error }) => {
    console.log(`  - ${file}: ${error}`);
  });
  process.exit(1);
}

console.log();
console.log('✅ Migration completed successfully!');
