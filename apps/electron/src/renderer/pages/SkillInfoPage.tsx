/**
 * SkillInfoPage
 *
 * Displays skill details including metadata, instructions content, and icon.
 * Allows editing the SKILL.md file via system editor.
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  FolderOpen,
  Pencil,
} from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { Spinner } from '@craft-agent/ui'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Markdown } from '@/components/markdown'
import type { LoadedSkill } from '../../shared/types'

interface SkillInfoPageProps {
  skillSlug: string
  workspaceId: string
}

/**
 * Section Header - matches Settings styling
 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
      {children}
    </h3>
  )
}

export default function SkillInfoPage({ skillSlug, workspaceId }: SkillInfoPageProps) {
  const [skill, setSkill] = useState<LoadedSkill | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load skill data
  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const loadSkill = async () => {
      try {
        const skills = await window.electronAPI.getSkills(workspaceId)

        if (!isMounted) return

        // Find the skill by slug
        const found = skills.find((s) => s.slug === skillSlug)
        if (found) {
          setSkill(found)
        } else {
          setError('Skill not found')
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Failed to load skill')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSkill()

    // Subscribe to skill changes
    const unsubscribe = window.electronAPI.onSkillsChanged?.((skills) => {
      const updated = skills.find((s) => s.slug === skillSlug)
      if (updated) {
        setSkill(updated)
      }
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [workspaceId, skillSlug])

  // Handle edit button click
  const handleEdit = async () => {
    if (!skill) return

    try {
      await window.electronAPI.openSkillInEditor(workspaceId, skillSlug)
    } catch (err) {
      console.error('Failed to open skill in editor:', err)
    }
  }

  // Handle open in finder
  const handleOpenInFinder = async () => {
    if (!skill) return

    try {
      await window.electronAPI.openSkillInFinder(workspaceId, skillSlug)
    } catch (err) {
      console.error('Failed to open skill in finder:', err)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error || !skill) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <AlertCircle className="mx-auto mb-2 h-8 w-8" />
          <p>{error || 'Skill not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <PanelHeader
        title={skill.metadata.name}
        actions={
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit SKILL.md</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleOpenInFinder}>
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in Finder</TooltipContent>
            </Tooltip>
          </div>
        }
      />
      <Separator />

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="py-6 px-5 space-y-6">
          {/* Skill Info Card */}
          <div className="flex items-start gap-4">
            <SkillAvatar skill={skill} size="lg" workspaceId={workspaceId} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">{skill.metadata.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {skill.metadata.description}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {(skill.metadata.globs || skill.metadata.alwaysAllow) && (
            <div className="space-y-4">
              <SectionHeader>Configuration</SectionHeader>

              {skill.metadata.globs && skill.metadata.globs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">File Patterns</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.metadata.globs.map((glob, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-foreground/5 rounded font-mono"
                      >
                        {glob}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {skill.metadata.alwaysAllow && skill.metadata.alwaysAllow.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Always Allowed Tools</p>
                  <div className="flex flex-wrap gap-1">
                    {skill.metadata.alwaysAllow.map((tool, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-xs bg-success/10 text-success rounded font-mono"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-2">
            <SectionHeader>Instructions</SectionHeader>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{skill.content || '*No instructions provided.*'}</Markdown>
            </div>
          </div>

          {/* Folder Path */}
          <div className="space-y-2">
            <SectionHeader>Location</SectionHeader>
            <p className="text-sm text-muted-foreground font-mono break-all">
              {skill.path}
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
