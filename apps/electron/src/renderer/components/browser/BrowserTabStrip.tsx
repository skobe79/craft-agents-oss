/**
 * BrowserTabStrip
 *
 * Rendered in the TopBar, shows compact badges for all active browser instances.
 * Clicking a badge focuses its dedicated browser window.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import * as Icons from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import {
  activeBrowserInstanceIdAtom,
  browserInstancesAtom,
  setBrowserInstancesAtom,
  updateBrowserInstanceAtom,
  removeBrowserInstanceAtom,
} from '@/atoms/browser-pane'
import { BrowserTabBadge } from './BrowserTabBadge'
import type { BrowserInstanceInfo } from '../../../shared/types'
import { getHostname } from './utils'

const MAX_VISIBLE_BADGES = 3

interface BrowserTabStripProps {
  activeSessionId?: string | null
}

export function BrowserTabStrip({ activeSessionId }: BrowserTabStripProps) {
  const instances = useAtomValue(browserInstancesAtom)
  const setInstances = useSetAtom(setBrowserInstancesAtom)
  const updateInstance = useSetAtom(updateBrowserInstanceAtom)
  const removeInstance = useSetAtom(removeBrowserInstanceAtom)
  const [activeInstanceId, setActiveInstanceId] = useAtom(activeBrowserInstanceIdAtom)
  const instancesRef = useRef(instances)

  const scopedInstances = useMemo(() => {
    if (!activeSessionId) return []
    return instances.filter((instance) => instance.boundSessionId === activeSessionId)
  }, [instances, activeSessionId])

  useEffect(() => {
    instancesRef.current = instances
  }, [instances])

  useEffect(() => {
    window.electronAPI.browserPane.list().then((items) => {
      setInstances(items)
      if (!activeSessionId) {
        setActiveInstanceId(null)
        return
      }
      const scoped = items.filter((instance) => instance.boundSessionId === activeSessionId)
      if (scoped.length > 0) {
        setActiveInstanceId((prev) => prev ?? scoped[0].id)
      }
    })
  }, [setInstances, activeSessionId, setActiveInstanceId])

  useEffect(() => {
    const cleanupState = window.electronAPI.browserPane.onStateChanged((info: BrowserInstanceInfo) => {
      updateInstance(info)
    })

    const cleanupRemoved = window.electronAPI.browserPane.onRemoved((id: string) => {
      removeInstance(id)
      setActiveInstanceId((prev) => {
        if (prev !== id) return prev
        const remaining = instancesRef.current.filter((item) => item.id !== id && item.boundSessionId === activeSessionId)
        return remaining[0]?.id ?? null
      })
    })

    const cleanupInteracted = window.electronAPI.browserPane.onInteracted((id: string) => {
      const instance = instancesRef.current.find((item) => item.id === id)
      if (!activeSessionId || instance?.boundSessionId !== activeSessionId) return
      setActiveInstanceId(id)
    })

    return () => {
      cleanupState()
      cleanupRemoved()
      cleanupInteracted()
    }
  }, [updateInstance, removeInstance, activeSessionId, setActiveInstanceId])

  useEffect(() => {
    if (!activeSessionId || scopedInstances.length === 0) {
      setActiveInstanceId(null)
      return
    }
    if (!activeInstanceId || !scopedInstances.some((item) => item.id === activeInstanceId)) {
      setActiveInstanceId(scopedInstances[0].id)
    }
  }, [activeSessionId, scopedInstances, activeInstanceId, setActiveInstanceId])

  const handleBadgeClick = useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId)
    void window.electronAPI.browserPane.focus(instanceId)
  }, [setActiveInstanceId])

  const handleBadgeClose = useCallback((instanceId: string) => {
    void window.electronAPI.browserPane.destroy(instanceId)
    removeInstance(instanceId)
    setActiveInstanceId((prev) => {
      if (prev !== instanceId) return prev
      const remaining = scopedInstances.filter((item) => item.id !== instanceId)
      return remaining[0]?.id ?? null
    })
  }, [removeInstance, scopedInstances, setActiveInstanceId])

  if (scopedInstances.length === 0) return null

  const visible = scopedInstances.slice(0, MAX_VISIBLE_BADGES)
  const overflow = scopedInstances.slice(MAX_VISIBLE_BADGES)

  return (
    <div className="flex items-center gap-1">
      {visible.map((instance) => (
        <BrowserTabBadge
          key={instance.id}
          instance={instance}
          isActive={instance.id === activeInstanceId}
          onClick={() => handleBadgeClick(instance.id)}
          onClose={() => handleBadgeClose(instance.id)}
        />
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-[26px] px-1.5 rounded-md text-[11px] text-foreground/50 bg-foreground/[0.04] border border-foreground/[0.06] hover:bg-foreground/[0.08] transition-colors cursor-pointer"
            >
              +{overflow.length}
            </button>
          </DropdownMenuTrigger>
          <StyledDropdownMenuContent align="end" minWidth="min-w-48">
            {overflow.map((instance) => {
              const hostname = getHostname(instance.url)
              return (
                <StyledDropdownMenuItem
                  key={instance.id}
                  onClick={() => handleBadgeClick(instance.id)}
                >
                  {instance.isLoading ? (
                    <Icons.Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icons.Globe className="h-3.5 w-3.5" />
                  )}
                  <span className="truncate">{instance.title || hostname}</span>
                </StyledDropdownMenuItem>
              )
            })}
          </StyledDropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
