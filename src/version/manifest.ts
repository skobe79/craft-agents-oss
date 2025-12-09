const VERSIONS_URL = 'https://versions.chaps.app/latest';

export async function getLatestVersion(): Promise<string | null> {
    try {
      const response = await fetch(VERSIONS_URL);
      const data = await response.json();
      const version = (data as { version?: string }).version;
      if (typeof version !== 'string') {
        console.error('Latest version is not a valid string');
      }
      return version ?? null;
    } catch (error) {
      console.error('Failed to get latest version:', error);
    }
    return null;
}

export async function getManifest(version: string): Promise<VersionManifest | null> {
    try {
        const response = await fetch(`${VERSIONS_URL}/${version}/manifest.json`);
        const data = await response.json();
        return data as VersionManifest;
    } catch (error) {
        console.error('Failed to get manifest:', error);
    }
    return null;
}


export interface VersionManifest {
  version: string;
  build_time: string;
  build_timestamp: number;
  binaries: Record<string, { url: string; sha256: string; size: number }>;
}
