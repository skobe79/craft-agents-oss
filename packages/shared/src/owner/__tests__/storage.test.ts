import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CONFIG_DIR } from '../../config/paths.ts';
import { loadOwnerProfile, saveOwnerProfile, updateOwnerProfile, getOwnerProfilePath } from '../storage.ts';
import { DEFAULT_OWNER_PROFILE } from '../schema.ts';

const OWNER_PROFILE_FILE = getOwnerProfilePath();
const PREFERENCES_FILE = join(CONFIG_DIR, 'preferences.json');

describe('owner profile storage and migration', () => {
  // Backup existing configuration if any
  let originalProfileContent: string | null = null;
  let originalPreferencesContent: string | null = null;

  beforeEach(() => {
    if (existsSync(OWNER_PROFILE_FILE)) {
      originalProfileContent = readFileSyncSafe(OWNER_PROFILE_FILE);
      unlinkSync(OWNER_PROFILE_FILE);
    } else {
      originalProfileContent = null;
    }
    if (existsSync(PREFERENCES_FILE)) {
      originalPreferencesContent = readFileSyncSafe(PREFERENCES_FILE);
      unlinkSync(PREFERENCES_FILE);
    } else {
      originalPreferencesContent = null;
    }
  });

  afterEach(() => {
    if (existsSync(OWNER_PROFILE_FILE)) {
      unlinkSync(OWNER_PROFILE_FILE);
    }
    if (existsSync(PREFERENCES_FILE)) {
      unlinkSync(PREFERENCES_FILE);
    }
    // Restore originals
    if (originalProfileContent !== null) {
      writeFileSync(OWNER_PROFILE_FILE, originalProfileContent, 'utf-8');
    }
    if (originalPreferencesContent !== null) {
      writeFileSync(PREFERENCES_FILE, originalPreferencesContent, 'utf-8');
    }
  });

  function readFileSyncSafe(path: string): string {
    const fs = require('fs');
    return fs.readFileSync(path, 'utf-8');
  }

  it('loads default owner profile when no files exist', () => {
    const profile = loadOwnerProfile();
    expect(profile.identity.name).toBe('Skobez');
    expect(profile.communication.verbosity).toBe(3);
    expect(profile.execution.defaultMode).toBe('owner-auto');
    expect(existsSync(OWNER_PROFILE_FILE)).toBe(true);
  });

  it('saves and loads configured owner profile text correctly', () => {
    const custom = {
      ...DEFAULT_OWNER_PROFILE,
      identity: {
        name: 'Richard',
        aliases: ['Richard'],
        locale: 'hu',
        timezone: 'CET',
      },
    };
    saveOwnerProfile(custom);
    const loaded = loadOwnerProfile();
    expect(loaded.identity.name).toBe('Richard');
    expect(loaded.identity.locale).toBe('hu');
    expect(loaded.identity.timezone).toBe('CET');
  });

  it('migrates name, timezone, and uiLanguage from legacy preferences.json', () => {
    const legacyPrefs = {
      name: 'SkobezLocal',
      timezone: 'Europe/Budapest',
      uiLanguage: 'pl',
    };
    writeFileSync(PREFERENCES_FILE, JSON.stringify(legacyPrefs, null, 2), 'utf-8');

    const loaded = loadOwnerProfile();
    // Verify migration
    expect(loaded.identity.name).toBe('SkobezLocal');
    expect(loaded.identity.timezone).toBe('Europe/Budapest');
    expect(loaded.identity.locale).toBe('pl');
    expect(loaded.identity.aliases).toContain('SkobezLocal');

    // Should also verify that preferences.json still exists and was not deleted/modified
    expect(existsSync(PREFERENCES_FILE)).toBe(true);
    const originalPrefsParsed = JSON.parse(readFileSyncSafe(PREFERENCES_FILE));
    expect(originalPrefsParsed.name).toBe('SkobezLocal');
  });

  it('safely updates profile fields using updateOwnerProfile', () => {
    // Generate default profile first
    loadOwnerProfile();
    
    updateOwnerProfile({
      identity: {
        name: 'NewName',
        aliases: ['NewName', 'Alt'],
        locale: 'en',
        timezone: 'UTC',
      },
      communication: {
        tone: 'highly sarcastic',
        verbosity: 1,
        bannedPhrases: ['None'],
      }
    });

    const loaded = loadOwnerProfile();
    expect(loaded.identity.name).toBe('NewName');
    expect(loaded.communication.verbosity).toBe(1);
    expect(loaded.communication.tone).toBe('highly sarcastic');
    // Ensure nested fields that were not updated (like execution mode) are preserved
    expect(loaded.execution.defaultMode).toBe('owner-auto');
  });
});
