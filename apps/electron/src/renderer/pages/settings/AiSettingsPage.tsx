/**
 * AiSettingsPage
 *
 * Unified AI settings page that consolidates all LLM-related configuration:
 * - Default connection, model, and thinking level
 * - Per-workspace overrides
 * - Connection management (add/edit/delete)
 *
 * Follows the Appearance settings pattern: app-level defaults + workspace overrides.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { X, MoreHorizontal, Pencil, Trash2, Star, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Spinner, FullscreenOverlayBase } from '@craft-agent/ui'
import { useSetAtom } from 'jotai'
import { fullscreenOverlayOpenAtom } from '@/atoms/overlay'
import { motion, AnimatePresence } from 'motion/react'
import type { LlmConnectionWithStatus, ThinkingLevel, WorkspaceSettings, Workspace } from '../../../shared/types'
import { DEFAULT_THINKING_LEVEL, THINKING_LEVELS } from '@craft-agent/shared/agent/thinking-levels'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
  StyledDropdownMenuSeparator,
} from '@/components/ui/styled-dropdown'
import { cn } from '@/lib/utils'

import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SettingsMenuSelectRow,
} from '@/components/settings'
import { useOnboarding } from '@/hooks/useOnboarding'
import { useWorkspaceIcon } from '@/hooks/useWorkspaceIcon'
import { OnboardingWizard } from '@/components/onboarding'
import { useAppShellContext } from '@/context/AppShellContext'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'ai',
}

// ============================================
// Connection Row Component
// ============================================

type ValidationState = 'idle' | 'validating' | 'success' | 'error'

interface ConnectionRowProps {
  connection: LlmConnectionWithStatus
  isLastConnection: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
  onValidate: () => void
  validationState: ValidationState
  validationError?: string
}

function ConnectionRow({ connection, isLastConnection, onEdit, onDelete, onSetDefault, onValidate, validationState, validationError }: ConnectionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  // Build description with provider, default indicator, auth status, and validation state
  const getDescription = () => {
    // Show validation state if not idle
    if (validationState === 'validating') return 'Validating...'
    if (validationState === 'success') return 'Connection valid'
    if (validationState === 'error') return validationError || 'Validation failed'

    const parts: string[] = []

    // Provider type
    switch (connection.type) {
      case 'anthropic': parts.push('Anthropic API'); break
      case 'openai': parts.push('OpenAI API'); break
      case 'openai-compat': parts.push('OpenAI Compatible'); break
      default: parts.push(connection.type)
    }

    // Default indicator
    if (connection.isDefault) parts.push('Default')

    // Auth status
    if (!connection.isAuthenticated) parts.push('Not authenticated')

    return parts.join(' · ')
  }

  return (
    <SettingsRow
      label={connection.name}
      description={getDescription()}
    >
      <DropdownMenu modal={true} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-md hover:bg-foreground/[0.05] data-[state=open]:bg-foreground/[0.05] transition-colors"
            data-state={menuOpen ? 'open' : 'closed'}
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <StyledDropdownMenuContent align="end">
          <StyledDropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </StyledDropdownMenuItem>
          {!connection.isDefault && (
            <StyledDropdownMenuItem onClick={onSetDefault}>
              <Star className="h-3.5 w-3.5" />
              <span>Set as default</span>
            </StyledDropdownMenuItem>
          )}
          <StyledDropdownMenuItem
            onClick={onValidate}
            disabled={validationState === 'validating'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Validate Connection</span>
          </StyledDropdownMenuItem>
          <StyledDropdownMenuSeparator />
          <StyledDropdownMenuItem
            onClick={onDelete}
            variant="destructive"
            disabled={isLastConnection}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </StyledDropdownMenuItem>
        </StyledDropdownMenuContent>
      </DropdownMenu>
    </SettingsRow>
  )
}

// ============================================
// Workspace Override Card Component
// ============================================

interface WorkspaceOverrideCardProps {
  workspace: Workspace
  llmConnections: LlmConnectionWithStatus[]
  customModel: string | null
  onSettingsChange: () => void
}

function WorkspaceOverrideCard({ workspace, llmConnections, customModel, onSettingsChange }: WorkspaceOverrideCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch workspace icon as data URL (file:// URLs don't work in renderer)
  const iconUrl = useWorkspaceIcon(workspace)

  // Load workspace settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!window.electronAPI) return
      setIsLoading(true)
      try {
        const ws = await window.electronAPI.getWorkspaceSettings(workspace.id)
        setSettings(ws)
      } catch (error) {
        console.error('Failed to load workspace settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [workspace.id])

  // Save workspace setting helper
  const updateSetting = useCallback(async <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.updateWorkspaceSetting(workspace.id, key, value)
      setSettings(prev => prev ? { ...prev, [key]: value } : null)
      onSettingsChange()
    } catch (error) {
      console.error(`Failed to save ${key}:`, error)
    }
  }, [workspace.id, onSettingsChange])

  const handleConnectionChange = useCallback((slug: string) => {
    // 'global' means use app default (clear workspace override)
    updateSetting('defaultLlmConnection', slug === 'global' ? undefined : slug)
  }, [updateSetting])

  const handleModelChange = useCallback((model: string) => {
    // 'global' means use app default (clear workspace override)
    updateSetting('model', model === 'global' ? undefined : model)
  }, [updateSetting])

  const handleThinkingChange = useCallback((level: string) => {
    // 'global' means use app default (clear workspace override)
    updateSetting('thinkingLevel', level === 'global' ? undefined : level as ThinkingLevel)
  }, [updateSetting])

  // Determine if workspace has any overrides
  const hasOverrides = settings && (
    settings.defaultLlmConnection ||
    settings.model ||
    settings.thinkingLevel
  )

  // Get display values
  const currentConnection = settings?.defaultLlmConnection || 'global'
  const currentModel = settings?.model || 'global'
  const currentThinking = settings?.thinkingLevel || 'global'

  // Get summary text for collapsed state
  const getSummary = () => {
    if (!hasOverrides) return 'Using defaults'
    const parts: string[] = []
    if (settings?.defaultLlmConnection) {
      const conn = llmConnections.find(c => c.slug === settings.defaultLlmConnection)
      parts.push(conn?.name || settings.defaultLlmConnection)
    }
    if (settings?.model) {
      const modelName = settings.model.includes('opus') ? 'Opus' :
        settings.model.includes('sonnet') ? 'Sonnet' :
        settings.model.includes('haiku') ? 'Haiku' : settings.model
      parts.push(modelName)
    }
    if (settings?.thinkingLevel) {
      const level = THINKING_LEVELS.find(l => l.id === settings.thinkingLevel)
      parts.push(level?.name || settings.thinkingLevel)
    }
    return parts.join(' · ')
  }

  return (
    <SettingsCard>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-6 h-6 rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center',
              'ring-1 ring-border/50'
            )}
          >
            {iconUrl ? (
              <img src={iconUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {workspace.name?.charAt(0)?.toUpperCase() || 'W'}
              </span>
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">{workspace.name}</div>
            <div className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : getSummary()}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-4 py-2">
              <SettingsMenuSelectRow
                label="Connection"
                description="API connection for new chats"
                value={currentConnection}
                onValueChange={handleConnectionChange}
                options={[
                  { value: 'global', label: 'Use default', description: 'Inherit from app settings' },
                  ...llmConnections.map((conn) => ({
                    value: conn.slug,
                    label: conn.name,
                    description: conn.type === 'anthropic' ? 'Anthropic' : conn.type === 'openai' ? 'OpenAI' : conn.type,
                  })),
                ]}
              />
              {/* Only show model selector if no custom model from connection */}
              {!customModel && (
                <SettingsMenuSelectRow
                  label="Model"
                  description="AI model for new chats"
                  value={currentModel}
                  onValueChange={handleModelChange}
                  options={[
                    { value: 'global', label: 'Use default', description: 'Inherit from app settings' },
                    { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5', description: 'Most capable' },
                    { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', description: 'Balanced' },
                    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: 'Fastest' },
                  ]}
                />
              )}
              <SettingsMenuSelectRow
                label="Thinking"
                description="Reasoning depth for new chats"
                value={currentThinking}
                onValueChange={handleThinkingChange}
                options={[
                  { value: 'global', label: 'Use default', description: 'Inherit from app settings' },
                  ...THINKING_LEVELS.map(({ id, name, description }) => ({
                    value: id,
                    label: name,
                    description,
                  })),
                ]}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsCard>
  )
}

// ============================================
// Main Component
// ============================================

export default function AiSettingsPage() {
  const { refreshCustomModel, llmConnections, refreshLlmConnections, customModel } = useAppShellContext()

  // API Setup overlay state
  const [showApiSetup, setShowApiSetup] = useState(false)
  const [editingConnectionSlug, setEditingConnectionSlug] = useState<string | null>(null)
  const setFullscreenOverlayOpen = useSetAtom(fullscreenOverlayOpenAtom)

  // Workspaces for override cards
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  // Default settings state (app-level)
  const [defaultModel, setDefaultModel] = useState('claude-sonnet-4-5-20250929')
  const [defaultThinking, setDefaultThinking] = useState<ThinkingLevel>(DEFAULT_THINKING_LEVEL)

  // Validation state per connection
  const [validationStates, setValidationStates] = useState<Record<string, {
    state: ValidationState
    error?: string
  }>>({})

  // Load workspaces and default settings
  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI) return
      try {
        const ws = await window.electronAPI.getWorkspaces()
        setWorkspaces(ws)

        // Load default model from first workspace for now (app-level defaults coming)
        // TODO: Add app-level default model/thinking IPC
        const model = await window.electronAPI.getModel()
        if (model) setDefaultModel(model)
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    load()
  }, [])

  // Helpers to open/close the fullscreen API setup overlay
  const openApiSetup = useCallback((connectionSlug?: string) => {
    setEditingConnectionSlug(connectionSlug || null)
    setShowApiSetup(true)
    setFullscreenOverlayOpen(true)
  }, [setFullscreenOverlayOpen])

  const closeApiSetup = useCallback(() => {
    setShowApiSetup(false)
    setFullscreenOverlayOpen(false)
    setEditingConnectionSlug(null)
  }, [setFullscreenOverlayOpen])

  // OnboardingWizard hook for editing API connection
  const apiSetupOnboarding = useOnboarding({
    initialStep: 'api-setup',
    onConfigSaved: refreshCustomModel,
    onComplete: () => {
      closeApiSetup()
      refreshLlmConnections?.()
      apiSetupOnboarding.reset()
    },
    onDismiss: () => {
      closeApiSetup()
      apiSetupOnboarding.reset()
    },
  })

  const handleApiSetupFinish = useCallback(() => {
    closeApiSetup()
    refreshLlmConnections?.()
    apiSetupOnboarding.reset()
  }, [closeApiSetup, refreshLlmConnections, apiSetupOnboarding])

  // Connection action handlers
  const handleEditConnection = useCallback((slug: string) => {
    openApiSetup(slug)
  }, [openApiSetup])

  const handleDeleteConnection = useCallback(async (slug: string) => {
    if (!window.electronAPI) return
    try {
      const result = await window.electronAPI.deleteLlmConnection(slug)
      if (result.success) {
        refreshLlmConnections?.()
      } else {
        console.error('Failed to delete connection:', result.error)
      }
    } catch (error) {
      console.error('Failed to delete connection:', error)
    }
  }, [refreshLlmConnections])

  const handleValidateConnection = useCallback(async (slug: string) => {
    if (!window.electronAPI) return

    // Set validating state
    setValidationStates(prev => ({ ...prev, [slug]: { state: 'validating' } }))

    try {
      const result = await window.electronAPI.testLlmConnection(slug)

      if (result.success) {
        setValidationStates(prev => ({ ...prev, [slug]: { state: 'success' } }))
        // Auto-clear success state after 3 seconds
        setTimeout(() => {
          setValidationStates(prev => ({ ...prev, [slug]: { state: 'idle' } }))
        }, 3000)
      } else {
        setValidationStates(prev => ({
          ...prev,
          [slug]: { state: 'error', error: result.error }
        }))
        // Auto-clear error state after 5 seconds
        setTimeout(() => {
          setValidationStates(prev => ({ ...prev, [slug]: { state: 'idle' } }))
        }, 5000)
      }
    } catch (error) {
      setValidationStates(prev => ({
        ...prev,
        [slug]: { state: 'error', error: 'Validation failed' }
      }))
      setTimeout(() => {
        setValidationStates(prev => ({ ...prev, [slug]: { state: 'idle' } }))
      }, 5000)
    }
  }, [])

  const handleSetDefaultConnection = useCallback(async (slug: string) => {
    if (!window.electronAPI) return
    try {
      const result = await window.electronAPI.setDefaultLlmConnection(slug)
      if (result.success) {
        refreshLlmConnections?.()
      } else {
        console.error('Failed to set default connection:', result.error)
      }
    } catch (error) {
      console.error('Failed to set default connection:', error)
    }
  }, [refreshLlmConnections])

  // App-level default handlers
  const handleDefaultModelChange = useCallback(async (model: string) => {
    if (!window.electronAPI) return
    setDefaultModel(model)
    await window.electronAPI.setModel(model)
  }, [])

  const handleDefaultThinkingChange = useCallback(async (level: ThinkingLevel) => {
    setDefaultThinking(level)
    // TODO: Add app-level thinking level storage
  }, [])

  // Get the default connection for display
  const defaultConnection = useMemo(() => {
    return llmConnections.find(c => c.isDefault)
  }, [llmConnections])

  // Refresh callback for workspace cards
  const handleWorkspaceSettingsChange = useCallback(() => {
    // Refresh context so changes propagate immediately
    refreshLlmConnections?.()
  }, [refreshLlmConnections])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="AI" actions={<HeaderMenu route={routes.view.settings('ai')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              {/* Default Settings */}
              <SettingsSection title="Default" description="Settings for new chats when no workspace override is set.">
                <SettingsCard>
                  <SettingsMenuSelectRow
                    label="Connection"
                    description="API connection for new chats"
                    value={defaultConnection?.slug || ''}
                    onValueChange={handleSetDefaultConnection}
                    options={llmConnections.map((conn) => ({
                      value: conn.slug,
                      label: conn.name,
                      description: conn.type === 'anthropic' ? 'Anthropic API' :
                                   conn.type === 'openai' ? 'OpenAI API' :
                                   conn.type === 'openai-compat' ? 'OpenAI Compatible' : conn.type,
                    }))}
                  />
                  {/* Only show model selector if no custom model from connection */}
                  {!customModel ? (
                    <SettingsMenuSelectRow
                      label="Model"
                      description="AI model for new chats"
                      value={defaultModel}
                      onValueChange={handleDefaultModelChange}
                      options={[
                        { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5', description: 'Most capable for complex work' },
                        { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', description: 'Best for everyday tasks' },
                        { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: 'Fastest for quick answers' },
                      ]}
                    />
                  ) : (
                    <SettingsRow
                      label="Model"
                      description="Set via API connection"
                    >
                      <span className="text-sm text-muted-foreground">{customModel}</span>
                    </SettingsRow>
                  )}
                  <SettingsMenuSelectRow
                    label="Thinking"
                    description="Reasoning depth for new chats"
                    value={defaultThinking}
                    onValueChange={(v) => handleDefaultThinkingChange(v as ThinkingLevel)}
                    options={THINKING_LEVELS.map(({ id, name, description }) => ({
                      value: id,
                      label: name,
                      description,
                    }))}
                  />
                </SettingsCard>
              </SettingsSection>

              {/* Workspace Overrides */}
              {workspaces.length > 0 && (
                <SettingsSection title="Workspace Overrides" description="Override default settings per workspace.">
                  <div className="space-y-2">
                    {workspaces.map((workspace) => (
                      <WorkspaceOverrideCard
                        key={workspace.id}
                        workspace={workspace}
                        llmConnections={llmConnections}
                        customModel={customModel}
                        onSettingsChange={handleWorkspaceSettingsChange}
                      />
                    ))}
                  </div>
                </SettingsSection>
              )}

              {/* Connections Management */}
              <SettingsSection title="Connections" description="Manage your AI provider connections.">
                <SettingsCard>
                  {llmConnections.map((conn) => (
                    <ConnectionRow
                      key={conn.slug}
                      connection={conn}
                      isLastConnection={llmConnections.length === 1}
                      onEdit={() => handleEditConnection(conn.slug)}
                      onDelete={() => handleDeleteConnection(conn.slug)}
                      onSetDefault={() => handleSetDefaultConnection(conn.slug)}
                      onValidate={() => handleValidateConnection(conn.slug)}
                      validationState={validationStates[conn.slug]?.state || 'idle'}
                      validationError={validationStates[conn.slug]?.error}
                    />
                  ))}
                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openApiSetup()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      + Add Connection
                    </Button>
                  </div>
                </SettingsCard>
              </SettingsSection>

              {/* API Setup Fullscreen Overlay */}
              <FullscreenOverlayBase
                isOpen={showApiSetup}
                onClose={closeApiSetup}
                className="z-splash flex flex-col bg-foreground-2"
              >
                <OnboardingWizard
                  state={apiSetupOnboarding.state}
                  onContinue={apiSetupOnboarding.handleContinue}
                  onBack={apiSetupOnboarding.handleBack}
                  onSelectApiSetupMethod={apiSetupOnboarding.handleSelectApiSetupMethod}
                  onSubmitCredential={apiSetupOnboarding.handleSubmitCredential}
                  onStartOAuth={apiSetupOnboarding.handleStartOAuth}
                  onFinish={handleApiSetupFinish}
                  isWaitingForCode={apiSetupOnboarding.isWaitingForCode}
                  onSubmitAuthCode={apiSetupOnboarding.handleSubmitAuthCode}
                  onCancelOAuth={apiSetupOnboarding.handleCancelOAuth}
                  className="h-full"
                />
                <div
                  className="fixed top-0 right-0 h-[50px] flex items-center pr-5 [-webkit-app-region:no-drag]"
                  style={{ zIndex: 'var(--z-fullscreen, 350)' }}
                >
                  <button
                    onClick={closeApiSetup}
                    className="p-1.5 rounded-[6px] transition-all bg-background shadow-minimal text-muted-foreground/50 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    title="Close (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </FullscreenOverlayBase>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
