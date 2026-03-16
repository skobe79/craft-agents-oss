import { statSync } from 'fs'

/**
 * Validate that a path is a usable working directory on the current server.
 * Platform is injectable for cross-platform unit testing without mocking globals.
 */
export function isValidWorkingDirectory(
  path: string,
  platform: NodeJS.Platform = process.platform
): { valid: boolean; reason?: string } {
  const isWindows = platform === 'win32'

  // Cross-platform path format check
  if (!isWindows) {
    if (/^[A-Za-z]:\\/.test(path))
      return { valid: false, reason: 'Windows drive path is not valid on this server. Use a server-side path.' }
    if (path.startsWith('\\\\'))
      return { valid: false, reason: 'UNC path is not valid on this server. Use a server-side path.' }
    if (!path.startsWith('/'))
      return { valid: false, reason: 'Path must be absolute (start with /).' }
  } else {
    // Windows: reject Unix-style absolute paths outright
    if (path.startsWith('/'))
      return { valid: false, reason: 'Unix path is not valid on this server. Use a Windows path (e.g., C:\\...).' }
  }

  // Existence + directory check
  try {
    const s = statSync(path)
    if (!s.isDirectory()) {
      return { valid: false, reason: `Not a directory: ${path}` }
    }
  } catch {
    return { valid: false, reason: `Directory not found: ${path}` }
  }

  return { valid: true }
}
