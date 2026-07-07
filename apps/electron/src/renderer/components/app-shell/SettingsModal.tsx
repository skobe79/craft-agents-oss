import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import SettingsNavigator from '@/pages/settings/SettingsNavigator'
import { getSettingsPageComponent } from '@/pages/settings/settings-pages'
import type { SettingsSubpage } from '../../../shared/settings-registry'
import * as storage from '@/lib/local-storage'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultSubpage?: SettingsSubpage
}

export function SettingsModal({ open, onOpenChange, defaultSubpage = 'app' }: SettingsModalProps) {
  const [activeSubpage, setActiveSubpage] = useState<SettingsSubpage>(
    () => storage.get<SettingsSubpage>(storage.KEYS.lastSettingsSubpage, defaultSubpage)
  )

  // Persist the subpage so when reopened it remembers the last selected tab
  useEffect(() => {
    storage.set(storage.KEYS.lastSettingsSubpage, activeSubpage)
  }, [activeSubpage])

  const SettingsPageComponent = getSettingsPageComponent(activeSubpage)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="!max-w-[1200px] w-[95vw] h-[90vh] p-0 flex overflow-hidden bg-background border-border shadow-strong"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Settings</DialogTitle>
        </VisuallyHidden>

        <div className="flex w-full h-full">
          {/* Sidebar */}
          <div className="w-[280px] flex-shrink-0 border-r border-border/5 bg-background-elevated overflow-y-auto">
            <div className="p-4 pt-6">
              <h2 className="text-xs font-semibold mb-2 px-4 text-muted-foreground uppercase tracking-wider">Settings</h2>
              <SettingsNavigator
                selectedSubpage={activeSubpage}
                onSelectSubpage={setActiveSubpage}
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto relative bg-background">
            <SettingsPageComponent />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
