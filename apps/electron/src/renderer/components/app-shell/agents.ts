/**
 * Agent Registry
 *
 * Defines the agents that appear in the "Agentz" sidebar tab.
 * Only Hermes Agent is enabled for now — the rest are placeholders.
 */

import {
  Bot,
  Sparkles,
  Terminal,
  Compass,
  Brain,
  type LucideIcon,
} from 'lucide-react'

export interface AgentDef {
  id: string
  title: string
  icon: LucideIcon
  enabled: boolean
  description: string
  connectionSlug?: string
}

export const AGENTZ: AgentDef[] = [
  {
    id: 'hermes',
    title: 'Hermes Agent',
    icon: Bot,
    enabled: true,
    description: 'Multi-agent command center — local models, ComfyUI, tools, skills',
    connectionSlug: 'anthropic-api',
  },
  {
    id: 'claude',
    title: 'Claude',
    icon: Sparkles,
    enabled: false,
    description: 'Anthropic Claude — coming soon',
  },
  {
    id: 'openclaw',
    title: 'OpenClaw',
    icon: Terminal,
    enabled: false,
    description: 'OpenClaw agent — coming soon',
  },
  {
    id: 'odysseus',
    title: 'Odysseus',
    icon: Compass,
    enabled: false,
    description: 'Odysseus agent — coming soon',
  },
  {
    id: 'pi',
    title: 'Pi',
    icon: Brain,
    enabled: false,
    description: 'Pi agent — coming soon',
  },
]

export const getAgentById = (id: string): AgentDef | undefined =>
  AGENTZ.find(a => a.id === id)