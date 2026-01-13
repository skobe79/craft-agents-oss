/**
 * Auto-update module for Electron app
 *
 * Handles checking for updates, downloading, and triggering installation.
 * Uses the custom manifest system at https://agents.craft.do/electron/
 */

import { app, BrowserWindow } from 'electron'
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { mainLog } from './logger'
import {
  getElectronLatestVersion,
  getElectronManifest,
  isNewerVersion,
  getPlatformKey,
  getAppVersion,
} from '@craft-agent/shared/version'
import type { UpdateInfo } from '../shared/types'
import type { WindowManager } from './window-manager'

// Module state
let updateInfo: UpdateInfo = {
  available: false,
  currentVersion: getAppVersion(),
  latestVersion: null,
  downloadUrl: null,
  downloadState: 'idle',
  downloadProgress: 0,
}

let windowManager: WindowManager | null = null
let downloadedInstallerPath: string | null = null

/**
 * Get the installer file extension for the current platform
 */
function getInstallerExtension(): string {
  switch (process.platform) {
    case 'win32':
      return '.exe'
    case 'linux':
      return '.AppImage'
    default:
      return '.dmg'
  }
}

/**
 * Set the window manager for broadcasting updates
 */
export function setWindowManager(wm: WindowManager): void {
  windowManager = wm
}

/**
 * Get current update info
 */
export function getUpdateInfo(): UpdateInfo {
  return { ...updateInfo }
}

/**
 * Broadcast update info to all renderer windows
 */
function broadcastUpdateInfo(): void {
  if (!windowManager) return

  const windows = windowManager.getAllWindows()
  for (const { window } of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('update:available', updateInfo)
    }
  }
}

/**
 * Broadcast download progress to all renderer windows
 */
function broadcastDownloadProgress(progress: number): void {
  if (!windowManager) return

  const windows = windowManager.getAllWindows()
  for (const { window } of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('update:downloadProgress', progress)
    }
  }
}

/**
 * Check for available updates
 * Returns UpdateInfo with available=true if a newer version exists
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  mainLog.info('[auto-update] Checking for updates...')

  const currentVersion = getAppVersion()
  updateInfo.currentVersion = currentVersion

  try {
    // Fetch latest version from server
    const latestVersion = await getElectronLatestVersion()

    if (!latestVersion) {
      mainLog.info('[auto-update] Could not fetch latest version')
      return updateInfo
    }

    updateInfo.latestVersion = latestVersion

    // Check if newer version is available
    if (!isNewerVersion(currentVersion, latestVersion)) {
      mainLog.info(`[auto-update] Already up to date (${currentVersion})`)
      updateInfo.available = false
      return updateInfo
    }

    mainLog.info(`[auto-update] Update available: ${currentVersion} → ${latestVersion}`)

    // Fetch manifest for download URL
    const manifest = await getElectronManifest(latestVersion)
    if (!manifest) {
      mainLog.error('[auto-update] Could not fetch manifest')
      return updateInfo
    }

    // Get download URL for current platform
    const platformKey = getPlatformKey()
    const binary = manifest.binaries[platformKey]

    if (!binary) {
      mainLog.error(`[auto-update] No binary found for platform: ${platformKey}`)
      return updateInfo
    }

    updateInfo.available = true
    updateInfo.downloadUrl = binary.url
    updateInfo.downloadState = 'idle'
    updateInfo.downloadProgress = 0

    // Start auto-download in background
    downloadUpdate().catch(err => {
      mainLog.error('[auto-update] Auto-download failed:', err)
    })

    // Broadcast to all windows
    broadcastUpdateInfo()

    return updateInfo
  } catch (error) {
    mainLog.error('[auto-update] Check failed:', error)
    return updateInfo
  }
}

/**
 * Download the update DMG
 */
export async function downloadUpdate(): Promise<void> {
  if (!updateInfo.available || !updateInfo.downloadUrl || !updateInfo.latestVersion) {
    mainLog.warn('[auto-update] No update to download')
    return
  }

  if (updateInfo.downloadState === 'downloading' || updateInfo.downloadState === 'ready') {
    mainLog.info('[auto-update] Download already in progress or complete')
    return
  }

  mainLog.info(`[auto-update] Downloading update from: ${updateInfo.downloadUrl}`)

  updateInfo.downloadState = 'downloading'
  updateInfo.downloadProgress = 0
  broadcastUpdateInfo()

  try {
    // Fetch manifest for checksum verification
    const manifest = await getElectronManifest(updateInfo.latestVersion)
    const platformKey = getPlatformKey()
    const binary = manifest?.binaries[platformKey]

    if (!binary) {
      throw new Error(`No binary info for platform: ${platformKey}`)
    }

    // Create temp directory for download
    const tempDir = join(app.getPath('temp'), 'craft-agent-updates')
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    // Download file with platform-specific extension
    const ext = getInstallerExtension()
    const installerPath = join(tempDir, `Craft-Agent-${updateInfo.latestVersion}${ext}`)

    // Remove existing file if present
    if (existsSync(installerPath)) {
      unlinkSync(installerPath)
    }

    const response = await fetch(updateInfo.downloadUrl)
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status}`)
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
    let downloadedBytes = 0

    // Create transform stream to track progress
    const progressStream = new TransformStream({
      transform(chunk, controller) {
        downloadedBytes += chunk.byteLength
        if (contentLength > 0) {
          const progress = Math.round((downloadedBytes / contentLength) * 100)
          if (progress !== updateInfo.downloadProgress) {
            updateInfo.downloadProgress = progress
            broadcastDownloadProgress(progress)
          }
        }
        controller.enqueue(chunk)
      },
    })

    // Pipe response through progress tracker to file
    const writeStream = createWriteStream(installerPath)
    const reader = response.body.pipeThrough(progressStream).getReader()

    const hash = createHash('sha256')

    // Manual read loop for Node.js compatibility
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(Buffer.from(value))
      writeStream.write(Buffer.from(value))
    }

    writeStream.end()

    // Wait for write stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    // Verify checksum
    const downloadedChecksum = hash.digest('hex')
    if (downloadedChecksum !== binary.sha256) {
      unlinkSync(installerPath)
      throw new Error(`Checksum mismatch: expected ${binary.sha256}, got ${downloadedChecksum}`)
    }

    mainLog.info('[auto-update] Download complete and verified')

    downloadedInstallerPath = installerPath
    updateInfo.downloadState = 'ready'
    updateInfo.downloadProgress = 100
    broadcastUpdateInfo()
  } catch (error) {
    mainLog.error('[auto-update] Download failed:', error)
    updateInfo.downloadState = 'error'
    updateInfo.error = error instanceof Error ? error.message : 'Download failed'
    broadcastUpdateInfo()
    throw error
  }
}

/**
 * Install the downloaded update and restart the app
 * Handles platform-specific installation methods
 */
export async function installUpdate(): Promise<void> {
  if (updateInfo.downloadState !== 'ready' || !downloadedInstallerPath) {
    throw new Error('No update ready to install')
  }

  mainLog.info(`[auto-update] Starting installation on ${process.platform}...`)

  updateInfo.downloadState = 'installing'
  broadcastUpdateInfo()

  try {
    switch (process.platform) {
      case 'darwin':
        await installMacOS()
        break
      case 'win32':
        await installWindows()
        break
      case 'linux':
        await installLinux()
        break
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }
  } catch (error) {
    mainLog.error('[auto-update] Installation failed:', error)
    updateInfo.downloadState = 'error'
    updateInfo.error = error instanceof Error ? error.message : 'Installation failed'
    broadcastUpdateInfo()
    throw error
  }
}

/**
 * macOS: Use self-update.sh script to mount DMG and copy to /Applications
 */
async function installMacOS(): Promise<void> {
  if (!downloadedInstallerPath) throw new Error('No installer path')

  const scriptPath = app.isPackaged
    ? join(process.resourcesPath, 'self-update.sh')
    : join(__dirname, '../scripts/self-update.sh')

  if (!existsSync(scriptPath)) {
    mainLog.warn('[auto-update] Self-update script not found, opening DMG manually')
    const { shell } = await import('electron')
    await shell.openPath(downloadedInstallerPath)
    return
  }

  const child = spawn('bash', [scriptPath, downloadedInstallerPath, app.getPath('exe')], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CRAFT_UPDATE_DMG: downloadedInstallerPath,
      CRAFT_APP_PATH: app.getPath('exe'),
    },
  })

  child.unref()
  mainLog.info('[auto-update] Quitting app for macOS update...')
  app.quit()
}

/**
 * Windows: Run NSIS installer silently with /S flag
 */
async function installWindows(): Promise<void> {
  if (!downloadedInstallerPath) throw new Error('No installer path')

  // Get the install directory (parent of the exe)
  const exePath = app.getPath('exe')
  const installDir = join(exePath, '..')

  // Spawn NSIS installer silently
  // /S = silent, /D= = install directory
  const child = spawn(downloadedInstallerPath, ['/S', `/D=${installDir}`], {
    detached: true,
    stdio: 'ignore',
  })

  child.unref()
  mainLog.info('[auto-update] Quitting app for Windows update...')
  app.quit()
}

/**
 * Linux: Replace AppImage in place and relaunch
 */
async function installLinux(): Promise<void> {
  if (!downloadedInstallerPath) throw new Error('No installer path')

  // Get current AppImage path from environment or exe path
  const currentPath = process.env.APPIMAGE || app.getPath('exe')

  // Create a temporary script to perform the update after app quits
  const scriptContent = `#!/bin/bash
sleep 2
cp "${downloadedInstallerPath}" "${currentPath}"
chmod +x "${currentPath}"
rm -f "${downloadedInstallerPath}"
"${currentPath}" &
`

  const scriptPath = join(app.getPath('temp'), 'craft-agent-update.sh')
  const { writeFileSync, chmodSync } = await import('fs')
  writeFileSync(scriptPath, scriptContent)
  chmodSync(scriptPath, '755')

  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
  })

  child.unref()
  mainLog.info('[auto-update] Quitting app for Linux update...')
  app.quit()
}

/**
 * Schedule update check after app startup
 * Delays check by a few seconds to not slow down startup
 */
export function scheduleUpdateCheck(delayMs = 5000): void {
  mainLog.info(`[auto-update] Scheduling update check in ${delayMs}ms`)

  setTimeout(() => {
    checkForUpdates().catch(err => {
      mainLog.error('[auto-update] Scheduled check failed:', err)
    })
  }, delayMs)
}
