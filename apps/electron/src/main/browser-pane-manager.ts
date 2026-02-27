/**
 * BrowserPaneManager
 *
 * Owns browser instances as dedicated BrowserWindow objects.
 * Each instance maps 1:1 to a full native window while preserving
 * shared session/cookie partition and CDP automation support.
 */

import { BrowserView, BrowserWindow, session, type Session as ElectronSession } from 'electron'
import { mainLog } from './logger'
import { BrowserCDP, type AccessibilitySnapshot, type ElementGeometry } from './browser-cdp'
import type { BrowserInstanceInfo } from '../shared/types'

export type { BrowserInstanceInfo }

const SESSION_PARTITION = 'persist:browser-pane'

interface BrowserInstance {
  id: string
  window: BrowserWindow
  pageView: BrowserView
  cdp: BrowserCDP
  currentUrl: string
  title: string
  favicon: string | null
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  boundSessionId: string | null
  ownerType: 'session' | 'manual'
  ownerSessionId: string | null
  isVisible: boolean
  keepAliveOnWindowClose: boolean
  lastAction: LastBrowserAction | null
}

interface CreateBrowserInstanceOptions {
  show?: boolean
  ownerType?: 'session' | 'manual'
  ownerSessionId?: string
}

export interface BrowserScreenshotOptions {
  mode?: 'raw' | 'agent'
  refs?: string[]
  includeLastAction?: boolean
  includeMetadata?: boolean
}

export interface BrowserScreenshotResult {
  png: Buffer
  metadata?: {
    mode: 'raw' | 'agent'
    viewport?: {
      width: number
      height: number
      dpr: number
      scrollX: number
      scrollY: number
    }
    targets?: Array<{
      ref: string
      role?: string
      name?: string
      box: { x: number; y: number; width: number; height: number }
      clickPoint: { x: number; y: number }
    }>
    action?: {
      tool: string
      ref?: string
      status: 'succeeded' | 'failed'
      timestamp: number
    }
    annotationPartial?: boolean
    warnings?: string[]
  }
}

interface LastBrowserAction {
  tool: string
  ref?: string
  status: 'succeeded' | 'failed'
  geometry?: ElementGeometry
  timestamp: number
}

let instanceCounter = 0

export class BrowserPaneManager {
  private instances: Map<string, BrowserInstance> = new Map()
  private destroyingIds: Set<string> = new Set()
  private stateChangeCallback: ((info: BrowserInstanceInfo) => void) | null = null
  private removedCallback: ((id: string) => void) | null = null
  private interactedCallback: ((id: string) => void) | null = null
  private partitionPermissionsInitialized = false

  onStateChange(callback: (info: BrowserInstanceInfo) => void): void {
    this.stateChangeCallback = callback
  }

  onRemoved(callback: (id: string) => void): void {
    this.removedCallback = callback
  }

  onInteracted(callback: (id: string) => void): void {
    this.interactedCallback = callback
  }

  createInstance(id?: string, options?: CreateBrowserInstanceOptions): string {
    const instanceId = id || `browser-${++instanceCounter}`
    const shouldShow = options?.show ?? false
    const ownerType = options?.ownerType ?? 'manual'
    const ownerSessionId = ownerType === 'session' ? (options?.ownerSessionId ?? null) : null

    if (this.instances.has(instanceId)) {
      mainLog.warn(`[browser-pane] Instance already exists, reusing: ${instanceId}`)
      return instanceId
    }

    const ses = session.fromPartition(SESSION_PARTITION)
    this.setupSessionPermissions(ses)

    const window = new BrowserWindow({
      width: 1200,
      height: 900,
      minWidth: 700,
      minHeight: 500,
      show: shouldShow,
      backgroundColor: '#0f1115',
      webPreferences: {
        partition: SESSION_PARTITION,
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const pageView = new BrowserView({
      webPreferences: {
        partition: SESSION_PARTITION,
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const cdp = new BrowserCDP(pageView.webContents)

    const instance: BrowserInstance = {
      id: instanceId,
      window,
      pageView,
      cdp,
      currentUrl: 'about:blank',
      title: 'New Tab',
      favicon: null,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      boundSessionId: ownerSessionId,
      ownerType,
      ownerSessionId,
      isVisible: shouldShow,
      keepAliveOnWindowClose: true,
      lastAction: null,
    }

    const defaultUa = pageView.webContents.userAgent || ''
    const sanitizedUa = defaultUa.replace(/\sElectron\/[^\s]+/g, '')
    if (sanitizedUa && sanitizedUa !== defaultUa) {
      pageView.webContents.setUserAgent(sanitizedUa)
    }

    window.setBrowserView(pageView)
    this.layoutPageView(instance)

    this.setupWindowListeners(instance)
    this.instances.set(instanceId, instance)
    this.emitStateChange(instance)
    mainLog.info(`[browser-pane] toolbar injector version: v3-native-frame`)
    mainLog.info(`[browser-pane] Created instance: ${instanceId} (show=${shouldShow}, ownerType=${ownerType}, ownerSessionId=${ownerSessionId ?? 'none'})`)

    void this.renderToolbarChrome(instance)
    void pageView.webContents.loadURL('about:blank')

    return instanceId
  }

  destroyInstance(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    if (!instance.window.isDestroyed()) {
      this.destroyingIds.add(id)
      instance.window.destroy()
    }

    // closed handler finalizes map cleanup; force cleanup if needed
    if (this.instances.has(id)) {
      instance.cdp.detach()
      this.instances.delete(id)
      this.removedCallback?.(id)
    }

    this.destroyingIds.delete(id)

    mainLog.info(`[browser-pane] Destroyed instance: ${id}`)
  }

  getInstance(id: string): BrowserInstance | undefined {
    return this.instances.get(id)
  }

  listInstances(): BrowserInstanceInfo[] {
    return Array.from(this.instances.values()).map(i => this.toInfo(i))
  }

  getWindowCount(): number {
    return this.instances.size
  }

  getBrowserWindows(): BrowserWindow[] {
    return Array.from(this.instances.values())
      .map((instance) => instance.window)
      .filter((win) => !win.isDestroyed())
  }

  async navigate(id: string, url: string): Promise<{ url: string; title: string }> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    let normalizedUrl = url.trim()
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedUrl)
    const isAbout = normalizedUrl.startsWith('about:')
    if (!hasScheme && !isAbout) {
      const looksLikeHost = /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|[\w-]+(?:\.[\w-]+)+)(?::\d+)?(?:\/|$)/i.test(normalizedUrl)
      if (looksLikeHost) {
        normalizedUrl = `https://${normalizedUrl}`
      } else {
        normalizedUrl = `https://duckduckgo.com/?q=${encodeURIComponent(normalizedUrl)}`
      }
    }

    const timeoutMs = 30_000

    await instance.cdp.setAgentVisualState({
      active: true,
      label: `browser_navigate • ${normalizedUrl}`,
      cursor: null,
    }).catch(() => {})

    try {
      const loaded = instance.pageView.webContents.loadURL(normalizedUrl)
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Navigation timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      )
      await Promise.race([loaded, timeout])
      await this.renderToolbarChrome(instance)

      await this.flashLiveActionOverlay(instance, {
        metadataText: `browser_navigate • ${instance.currentUrl}`,
      })

      return { url: instance.currentUrl, title: instance.title }
    } catch (error) {
      await instance.cdp.setAgentVisualState({
        active: true,
        label: `browser_navigate failed`,
        cursor: null,
      }).catch(() => {})
      throw error
    }
  }

  async goBack(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)
    if (instance.pageView.webContents.canGoBack()) {
      instance.pageView.webContents.goBack()
    }
  }

  async goForward(id: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)
    if (instance.pageView.webContents.canGoForward()) {
      instance.pageView.webContents.goForward()
    }
  }

  reload(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return
    instance.pageView.webContents.reload()
  }

  stop(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return
    instance.pageView.webContents.stop()
  }

  focus(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    const win = instance.window
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()

    instance.isVisible = true
    this.emitStateChange(instance)
  }

  hide(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    const win = instance.window
    if (win.isDestroyed()) return
    win.hide()

    instance.isVisible = false
    this.emitStateChange(instance)
  }

  async getAccessibilitySnapshot(id: string): Promise<AccessibilitySnapshot> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)
    return instance.cdp.getAccessibilitySnapshot()
  }

  async clickElement(id: string, ref: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    await instance.cdp.setAgentVisualState({
      active: true,
      label: `browser_click • ${ref}`,
      cursor: null,
    }).catch(() => {})

    try {
      const geometry = await instance.cdp.clickElement(ref)
      instance.lastAction = {
        tool: 'browser_click',
        ref,
        status: 'succeeded',
        geometry,
        timestamp: Date.now(),
      }
      await this.flashLiveActionOverlay(instance, {
        geometries: [geometry],
        metadataText: `browser_click • ${ref}`,
      })
    } catch (error) {
      instance.lastAction = {
        tool: 'browser_click',
        ref,
        status: 'failed',
        timestamp: Date.now(),
      }
      await instance.cdp.setAgentVisualState({
        active: true,
        label: `browser_click failed • ${ref}`,
        cursor: null,
      }).catch(() => {})
      throw error
    }
  }

  async fillElement(id: string, ref: string, value: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    await instance.cdp.setAgentVisualState({
      active: true,
      label: `browser_fill • ${ref}`,
      cursor: null,
    }).catch(() => {})

    try {
      const geometry = await instance.cdp.fillElement(ref, value)
      instance.lastAction = {
        tool: 'browser_fill',
        ref,
        status: 'succeeded',
        geometry,
        timestamp: Date.now(),
      }
      await this.flashLiveActionOverlay(instance, {
        geometries: [geometry],
        metadataText: `browser_fill • ${ref}`,
      })
    } catch (error) {
      instance.lastAction = {
        tool: 'browser_fill',
        ref,
        status: 'failed',
        timestamp: Date.now(),
      }
      await instance.cdp.setAgentVisualState({
        active: true,
        label: `browser_fill failed • ${ref}`,
        cursor: null,
      }).catch(() => {})
      throw error
    }
  }

  async selectOption(id: string, ref: string, value: string): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    await instance.cdp.setAgentVisualState({
      active: true,
      label: `browser_select • ${ref}`,
      cursor: null,
    }).catch(() => {})

    try {
      const geometry = await instance.cdp.selectOption(ref, value)
      instance.lastAction = {
        tool: 'browser_select',
        ref,
        status: 'succeeded',
        geometry,
        timestamp: Date.now(),
      }
      await this.flashLiveActionOverlay(instance, {
        geometries: [geometry],
        metadataText: `browser_select • ${ref}`,
      })
    } catch (error) {
      instance.lastAction = {
        tool: 'browser_select',
        ref,
        status: 'failed',
        timestamp: Date.now(),
      }
      await instance.cdp.setAgentVisualState({
        active: true,
        label: `browser_select failed • ${ref}`,
        cursor: null,
      }).catch(() => {})
      throw error
    }
  }

  async screenshot(id: string, options?: BrowserScreenshotOptions): Promise<BrowserScreenshotResult> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    const mode = options?.mode === 'agent' ? 'agent' : 'raw'

    if (mode === 'raw') {
      const image = await instance.pageView.webContents.capturePage()
      return {
        png: image.toPNG(),
        metadata: options?.includeMetadata ? { mode: 'raw' } : undefined,
      }
    }

    const warnings: string[] = []
    const geometries: ElementGeometry[] = []

    const refs = options?.refs ?? []
    for (const ref of refs) {
      try {
        geometries.push(await instance.cdp.getElementGeometry(ref))
      } catch (error) {
        warnings.push(`Could not resolve ref ${ref}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (options?.includeLastAction && instance.lastAction?.geometry) {
      geometries.push(instance.lastAction.geometry)
    }

    const metadataText = instance.lastAction
      ? `${instance.lastAction.tool} • ${instance.lastAction.status} • ${new Date(instance.lastAction.timestamp).toISOString()}`
      : `browser_screenshot • ${new Date().toISOString()}`

    let annotationPartial = false

    try {
      if (geometries.length > 0 || options?.includeMetadata) {
        await instance.cdp.renderTemporaryOverlay({
          geometries,
          includeMetadata: !!options?.includeMetadata,
          metadataText,
          includeClickPoints: true,
        })
      }
    } catch (error) {
      annotationPartial = true
      warnings.push(`Annotation overlay failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
      const viewport = await instance.cdp.getViewportMetrics()
      const image = await instance.pageView.webContents.capturePage()

      return {
        png: image.toPNG(),
        metadata: {
          mode: 'agent',
          viewport,
          targets: geometries.map((g) => ({
            ref: g.ref,
            role: g.role,
            name: g.name,
            box: g.box,
            clickPoint: g.clickPoint,
          })),
          action: instance.lastAction
            ? {
              tool: instance.lastAction.tool,
              ref: instance.lastAction.ref,
              status: instance.lastAction.status,
              timestamp: instance.lastAction.timestamp,
            }
            : undefined,
          annotationPartial,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      }
    } finally {
      try {
        await instance.cdp.clearTemporaryOverlay()
      } catch {
        // ignore cleanup errors
      }
    }
  }

  async evaluate(id: string, expression: string): Promise<unknown> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)
    return instance.pageView.webContents.executeJavaScript(expression)
  }

  async scroll(id: string, direction: 'up' | 'down' | 'left' | 'right', amount = 500): Promise<void> {
    const instance = this.instances.get(id)
    if (!instance) throw new Error(`Browser instance not found: ${id}`)

    const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0
    const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0

    await instance.pageView.webContents.executeJavaScript(`window.scrollBy(${deltaX}, ${deltaY})`)
  }

  bindSession(id: string, sessionId: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.boundSessionId = sessionId
      instance.ownerType = 'session'
      instance.ownerSessionId = sessionId
      this.emitStateChange(instance)
    }
  }

  unbindSession(id: string): void {
    const instance = this.instances.get(id)
    if (instance) {
      instance.boundSessionId = null
      instance.ownerType = 'manual'
      instance.ownerSessionId = null
      this.emitStateChange(instance)
    }
  }

  getBoundForSession(sessionId: string): string | null {
    for (const instance of this.instances.values()) {
      if (instance.ownerType === 'session' && instance.ownerSessionId === sessionId) {
        return instance.id
      }
    }
    return null
  }

  createForSession(sessionId: string, options?: { show?: boolean }): string {
    const existing = this.getBoundForSession(sessionId)
    if (existing) {
      if (options?.show) {
        this.focus(existing)
      }
      return existing
    }

    return this.createInstance(undefined, {
      show: options?.show ?? false,
      ownerType: 'session',
      ownerSessionId: sessionId,
    })
  }

  focusBoundForSession(sessionId: string): string {
    const id = this.createForSession(sessionId, { show: true })
    this.focus(id)
    return id
  }

  getOrCreateForSession(sessionId: string): string {
    return this.createForSession(sessionId, { show: false })
  }

  destroyForSession(sessionId: string): void {
    for (const [id, instance] of this.instances) {
      if (instance.boundSessionId === sessionId) {
        this.destroyInstance(id)
      }
    }
  }

  async clearVisualsForSession(sessionId: string): Promise<void> {
    const clears: Promise<void>[] = []
    for (const instance of this.instances.values()) {
      if (instance.boundSessionId === sessionId) {
        clears.push(instance.cdp.clearAgentVisualState().catch(() => {}))
      }
    }
    await Promise.all(clears)
  }

  destroyAll(): void {
    for (const id of [...this.instances.keys()]) {
      this.destroyInstance(id)
    }
  }

  private layoutPageView(instance: BrowserInstance): void {
    const [width, height] = instance.window.getContentSize()
    const toolbarHeight = 48
    instance.pageView.setBounds({ x: 0, y: toolbarHeight, width, height: Math.max(100, height - toolbarHeight) })
    instance.pageView.setAutoResize({ width: true, height: true })
  }

  private async renderToolbarChrome(instance: BrowserInstance): Promise<void> {
    const escape = (value: string) => value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    const rawUrl = instance.currentUrl || 'about:blank'
    const url = escape(rawUrl)
    const backDisabled = instance.canGoBack ? '' : 'disabled'
    const forwardDisabled = instance.canGoForward ? '' : 'disabled'
    const loadingLabel = instance.isLoading ? 'Stop' : 'Reload'
    const loadingAction = instance.isLoading ? 'stop' : 'reload'
    const stoplightInset = process.platform === 'darwin' ? 86 : 0

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --fg: #26242a;
        --fg-40: rgba(38, 36, 42, 0.4);
        --fg-50: rgba(38, 36, 42, 0.5);
        --fg-70: rgba(38, 36, 42, 0.7);
        --fg-5: rgba(38, 36, 42, 0.05);
        --fg-6: rgba(38, 36, 42, 0.06);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #2f2c34;
          --fg: #e3e2e5;
          --fg-40: rgba(227, 226, 229, 0.4);
          --fg-50: rgba(227, 226, 229, 0.5);
          --fg-70: rgba(227, 226, 229, 0.7);
          --fg-5: rgba(227, 226, 229, 0.05);
          --fg-6: rgba(227, 226, 229, 0.06);
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: var(--bg);
        color: var(--fg);
      }
      .bar {
        height: 48px;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0 12px 0 ${12 + stoplightInset}px;
        border-bottom: 1px solid var(--fg-6);
      }
      .btn {
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--fg-70);
        cursor: pointer;
        transition: background-color 120ms ease;
      }
      .btn:hover { background: var(--fg-5); }
      .btn:disabled { opacity: 0.3; pointer-events: none; }
      .reload { width: auto; min-width: 28px; padding: 0 8px; font-size: 11px; }
      form { flex: 1; display: flex; min-width: 220px; }
      .url {
        width: 100%;
        height: 30px;
        border-radius: 8px;
        border: 1px solid var(--fg-6);
        background: transparent;
        color: var(--fg-70);
        font-size: 13px;
        padding: 0 10px;
        outline: none;
      }
      .url:focus { border-color: var(--fg-40); }
      .status {
        margin-left: 8px;
        max-width: 220px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--fg-50);
      }
      @media (max-width: 780px) {
        .status { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="bar">
      <button class="btn" ${backDisabled} onclick="location.href='craft-browser://back'">‹</button>
      <button class="btn" ${forwardDisabled} onclick="location.href='craft-browser://forward'">›</button>
      <button class="btn reload" onclick="location.href='craft-browser://${loadingAction}'">${loadingLabel}</button>
      <form onsubmit="event.preventDefault(); location.href='craft-browser://navigate?url=' + encodeURIComponent(document.getElementById('url').value);">
        <input id="url" class="url" value="${url}" />
      </form>
      <div class="status">${escape(instance.title || 'New Tab')}</div>
    </div>
  </body>
</html>`

    try {
      await instance.window.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    } catch (error) {
      mainLog.warn(`[browser-pane] toolbar chrome render failed id=${instance.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async handleToolbarAction(instance: BrowserInstance, url: string): Promise<boolean> {
    if (!url.startsWith('craft-browser://')) return false

    const parsed = new URL(url)
    const action = parsed.hostname

    switch (action) {
      case 'back':
        await this.goBack(instance.id)
        break
      case 'forward':
        await this.goForward(instance.id)
        break
      case 'reload':
        this.reload(instance.id)
        break
      case 'stop':
        this.stop(instance.id)
        break
      case 'navigate': {
        const target = parsed.searchParams.get('url') || ''
        if (target.trim()) {
          await this.navigate(instance.id, target)
        }
        break
      }
      default:
        break
    }

    return true
  }

  private async flashLiveActionOverlay(instance: BrowserInstance, params: {
    geometries?: ElementGeometry[]
    metadataText: string
  }): Promise<void> {
    try {
      const first = params.geometries?.[0]
      await instance.cdp.setAgentVisualState({
        active: true,
        label: params.metadataText,
        cursor: first?.clickPoint ?? null,
      })

      // Turn-scoped hold: do not auto-clear here.
      // Session lifecycle is responsible for clearing visuals at turn end.
    } catch {
      // best-effort visual aid only
    }
  }

  private setupSessionPermissions(ses: ElectronSession): void {
    if (this.partitionPermissionsInitialized) return
    this.partitionPermissionsInitialized = true

    const allow = new Set([
      'fullscreen',
      'pointerLock',
      'window-management',
      'notifications',
      'geolocation',
      'media',
      'clipboard-read',
      'clipboard-sanitized-write',
      'idle-detection',
    ])

    if (typeof ses.setPermissionCheckHandler === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ses.setPermissionCheckHandler((_webContents, permission: string, requestingOrigin: string, _details: any) => {
        const allowed = allow.has(permission)
        if (!allowed) {
          mainLog.warn(`[browser-pane] permission denied (check): ${permission} origin=${requestingOrigin}`)
        }
        return allowed
      })
    }

    if (typeof ses.setPermissionRequestHandler === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ses.setPermissionRequestHandler((_webContents, permission: string, callback: (allow: boolean) => void, details: any) => {
        const allowed = allow.has(permission)
        if (!allowed) {
          mainLog.warn(`[browser-pane] permission denied (request): ${permission} origin=${details?.requestingOrigin ?? 'unknown'}`)
        }
        callback(allowed)
      })
    }
  }

  private setupWindowListeners(instance: BrowserInstance): void {
    const pageWc = instance.pageView.webContents
    const toolbarWc = instance.window.webContents

    instance.window.on('close', (event) => {
      const explicitDestroy = this.destroyingIds.has(instance.id)
      if (!explicitDestroy && instance.keepAliveOnWindowClose) {
        event.preventDefault()
        instance.window.hide()
      }
    })

    instance.window.on('resize', () => {
      this.layoutPageView(instance)
    })

    toolbarWc.on('will-navigate', (event, url) => {
      void (async () => {
        if (!url.startsWith('craft-browser://')) return
        event.preventDefault()
        await this.handleToolbarAction(instance, url)
        await this.renderToolbarChrome(instance)
      })()
    })

    pageWc.on('did-start-loading', () => {
      instance.isLoading = true
      this.emitStateChange(instance)
      void this.renderToolbarChrome(instance)
    })

    pageWc.on('did-stop-loading', () => {
      instance.isLoading = false
      instance.canGoBack = pageWc.canGoBack()
      instance.canGoForward = pageWc.canGoForward()
      this.emitStateChange(instance)
      void this.renderToolbarChrome(instance)
    })

    pageWc.on('did-navigate', (_event, url) => {
      instance.currentUrl = url
      instance.title = pageWc.getTitle()
      instance.canGoBack = pageWc.canGoBack()
      instance.canGoForward = pageWc.canGoForward()
      this.emitStateChange(instance)
      void this.renderToolbarChrome(instance)
    })

    pageWc.on('did-navigate-in-page', (_event, url) => {
      instance.currentUrl = url
      instance.canGoBack = pageWc.canGoBack()
      instance.canGoForward = pageWc.canGoForward()
      this.emitStateChange(instance)
      void this.renderToolbarChrome(instance)
    })

    pageWc.on('page-title-updated', (_event, title) => {
      instance.title = title
      this.emitStateChange(instance)
      void this.renderToolbarChrome(instance)
    })

    pageWc.on('page-favicon-updated', (_event, favicons) => {
      instance.favicon = favicons[0] || null
      this.emitStateChange(instance)
    })

    pageWc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      mainLog.warn(`[browser-pane] did-fail-load id=${instance.id} code=${errorCode} url=${validatedURL} error=${errorDescription}`)
    })

    pageWc.on('console-message', (_event, level, message) => {
      if (level >= 2) {
        mainLog.warn(`[browser-pane] console id=${instance.id} level=${level}: ${message}`)
      }
    })

    // Keep popups in the same browser window
    pageWc.setWindowOpenHandler((details) => {
      void pageWc.loadURL(details.url)
      return { action: 'deny' }
    })

    pageWc.on('focus', () => {
      this.interactedCallback?.(instance.id)
    })

    instance.window.on('focus', () => {
      this.interactedCallback?.(instance.id)
    })

    instance.window.on('show', () => {
      instance.isVisible = true
      this.emitStateChange(instance)
    })

    instance.window.on('hide', () => {
      instance.isVisible = false
      this.emitStateChange(instance)
      void instance.cdp.clearAgentVisualState().catch(() => {})
    })

    instance.window.on('closed', () => {
      if (!this.instances.has(instance.id)) return
      this.destroyingIds.delete(instance.id)
      void instance.cdp.clearAgentVisualState().catch(() => {})
      instance.cdp.detach()
      this.instances.delete(instance.id)
      this.removedCallback?.(instance.id)
      mainLog.info(`[browser-pane] Destroyed instance: ${instance.id}`)
    })
  }

  private toInfo(instance: BrowserInstance): BrowserInstanceInfo {
    return {
      id: instance.id,
      url: instance.currentUrl,
      title: instance.title,
      favicon: instance.favicon,
      isLoading: instance.isLoading,
      canGoBack: instance.canGoBack,
      canGoForward: instance.canGoForward,
      boundSessionId: instance.boundSessionId,
      ownerType: instance.ownerType,
      ownerSessionId: instance.ownerSessionId,
      isVisible: instance.isVisible,
    }
  }

  private emitStateChange(instance: BrowserInstance): void {
    this.stateChangeCallback?.(this.toInfo(instance))
  }
}
