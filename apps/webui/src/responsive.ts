import { useCallback, useEffect, useMemo, useState } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 768px)'
const LOCATION_CHANGE_EVENT = 'craft-webui-locationchange'

export type WebUiMobileView = 'list' | 'content'

interface ResponsiveState {
  isMobile: boolean
  route: string
  view: WebUiMobileView
  backRoute: string | null
}

function getCurrentRoute(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('route') || 'allSessions'
}

function getMobileView(route: string): WebUiMobileView {
  if (
    /\/session\/[^/]+$/.test(route) ||
    /\/source\/[^/]+$/.test(route) ||
    /\/skill\/[^/]+$/.test(route) ||
    /\/automation\/[^/]+$/.test(route) ||
    route.startsWith('settings/')
  ) {
    return 'content'
  }

  return 'list'
}

function getBackRoute(route: string): string | null {
  if (/^(allSessions|flagged|archived)\/session\/[^/]+$/.test(route)) {
    return route.replace(/\/session\/[^/]+$/, '')
  }
  if (/^state\/[^/]+\/session\/[^/]+$/.test(route)) {
    return route.replace(/\/session\/[^/]+$/, '')
  }
  if (/^label\/[^/]+\/session\/[^/]+$/.test(route)) {
    return route.replace(/\/session\/[^/]+$/, '')
  }
  if (/^view\/[^/]+\/session\/[^/]+$/.test(route)) {
    return route.replace(/\/session\/[^/]+$/, '')
  }
  if (/^sources(?:\/(?:api|mcp|local))?\/source\/[^/]+$/.test(route)) {
    return route.replace(/\/source\/[^/]+$/, '')
  }
  if (/^skills\/skill\/[^/]+$/.test(route)) {
    return 'skills'
  }
  if (/^automations(?:\/(?:scheduled|event|agentic))?\/automation\/[^/]+$/.test(route)) {
    return route.replace(/\/automation\/[^/]+$/, '')
  }
  if (route.startsWith('settings/')) {
    return 'settings'
  }
  return null
}

function readResponsiveState(): ResponsiveState {
  const route = getCurrentRoute()
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches
  return {
    isMobile,
    route,
    view: getMobileView(route),
    backRoute: getBackRoute(route),
  }
}

function applyDocumentState(state: ResponsiveState): void {
  const root = document.documentElement

  root.dataset.webuiMobile = state.isMobile ? 'true' : 'false'
  root.dataset.webuiMobileView = state.view
  root.dataset.webuiRoute = state.route

  if (state.isMobile) {
    document.body.dataset.webuiMobile = 'true'
    localStorage.setItem('craft-sidebar-visible', JSON.stringify(false))
    localStorage.setItem('craft-focus-mode-enabled', JSON.stringify(false))
  } else {
    delete document.body.dataset.webuiMobile
  }
}

function emitLocationChange(): void {
  const state = readResponsiveState()
  applyDocumentState(state)
  window.dispatchEvent(new CustomEvent(LOCATION_CHANGE_EVENT, { detail: state }))
}

export function navigateMobileToRoute(route: string, options?: { replace?: boolean }): void {
  const url = new URL(window.location.href)
  url.searchParams.set('route', route)
  url.searchParams.delete('panels')
  url.searchParams.delete('fi')
  url.searchParams.delete('sidebar')

  const method = options?.replace ? history.replaceState.bind(history) : history.pushState.bind(history)
  method(history.state, '', url.toString())

  window.dispatchEvent(new PopStateEvent('popstate'))
  emitLocationChange()
}

export function initializeResponsiveShell(): () => void {
  const media = window.matchMedia(MOBILE_MEDIA_QUERY)

  const onMediaChange = () => emitLocationChange()
  const onPopState = () => emitLocationChange()

  const originalPushState = history.pushState.bind(history)
  const originalReplaceState = history.replaceState.bind(history)

  history.pushState = function (...args) {
    const result = originalPushState(...args)
    emitLocationChange()
    return result
  }

  history.replaceState = function (...args) {
    const result = originalReplaceState(...args)
    emitLocationChange()
    return result
  }

  media.addEventListener('change', onMediaChange)
  window.addEventListener('popstate', onPopState)

  emitLocationChange()

  return () => {
    history.pushState = originalPushState
    history.replaceState = originalReplaceState
    media.removeEventListener('change', onMediaChange)
    window.removeEventListener('popstate', onPopState)
  }
}

export function useResponsiveShellState(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => readResponsiveState())

  useEffect(() => {
    const sync = () => setState(readResponsiveState())
    window.addEventListener(LOCATION_CHANGE_EVENT, sync)
    sync()
    return () => window.removeEventListener(LOCATION_CHANGE_EVENT, sync)
  }, [])

  return state
}

export function useMobileBackToList(): (() => void) | null {
  const { backRoute } = useResponsiveShellState()

  return useMemo(() => {
    if (!backRoute) return null
    return () => navigateMobileToRoute(backRoute)
  }, [backRoute])
}

export function useMobileNavigateToList(): (route: string) => void {
  return useCallback((route: string) => {
    navigateMobileToRoute(route)
  }, [])
}
