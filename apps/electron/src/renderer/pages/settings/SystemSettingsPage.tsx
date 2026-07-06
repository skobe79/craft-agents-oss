import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import { SettingsSection, SettingsCard } from '@/components/settings'
import { Cpu, HardDrive, Shield, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'system',
}

interface Specs {
  cpu: string
  ramGb: number
  gpu: string
  vramMb: number
}

interface ModelRecommendation {
  name: string
  size: string
  description: string
  requiredRam: number
  requiredVram: number
}

const LOCAL_MODELS: ModelRecommendation[] = [
  {
    name: 'Phi-3 Mini / Qwen 2.5 3B',
    size: '3B - 4B',
    description: 'Fast, lightweight models ideal for basic coding assistance and writing tasks.',
    requiredRam: 8,
    requiredVram: 3,
  },
  {
    name: 'Llama 3.1 8B / Qwen 2.5 7B',
    size: '7B - 8B',
    description: 'Balanced models with excellent general capability, reasoning, and programming skills.',
    requiredRam: 16,
    requiredVram: 8,
  },
  {
    name: 'Llama 3.1 70B',
    size: '70B',
    description: 'High-capability reasoning model for complex code architecture and multi-step logic.',
    requiredRam: 48,
    requiredVram: 40,
  },
]

export default function SystemSettingsPage() {
  const { t } = useTranslation()
  const [specs, setSpecs] = useState<Specs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSpecs = async () => {
      if (!window.electronAPI) return
      try {
        const result = await window.electronAPI.getSystemSpecs()
        setSpecs(result)
      } catch (err) {
        console.error('Failed to retrieve system specs:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSpecs()
  }, [])

  const getCompatibility = (model: ModelRecommendation) => {
    if (!specs) return { status: 'unknown', text: 'Unknown', color: 'text-muted-foreground bg-foreground/[0.04]' }

    const hasVram = specs.vramMb >= model.requiredVram * 1024
    const hasRam = specs.ramGb >= model.requiredRam

    if (hasVram && hasRam) {
      return {
        status: 'great',
        text: 'Fits in GPU VRAM (Best Performance)',
        color: 'text-success bg-success/10 border border-success/20',
        icon: <CheckCircle className="size-4 text-success shrink-0" />,
      }
    } else if (hasRam) {
      return {
        status: 'partial',
        text: 'Partial CPU Offload (Moderate Performance)',
        color: 'text-warning bg-warning/10 border border-warning/20',
        icon: <AlertTriangle className="size-4 text-warning shrink-0" />,
      }
    } else {
      return {
        status: 'insufficient',
        text: 'Insufficient RAM / Hardware (Not Recommended)',
        color: 'text-destructive bg-destructive/10 border border-destructive/20',
        icon: <AlertTriangle className="size-4 text-destructive shrink-0" />,
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={t("settings.system.title")} actions={<HeaderMenu route={routes.view.settings('system')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              {/* System Specs Diagnostic */}
              <SettingsSection
                title="Hardware Diagnostics"
                description="Detected local system hardware configuration for AI acceleration."
              >
                {loading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground animate-pulse">
                    Scanning local hardware devices...
                  </div>
                ) : specs ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CPU & Memory Card */}
                    <SettingsCard className="p-4 flex gap-4 items-start">
                      <div className="p-2 rounded-xl bg-foreground/[0.04]">
                        <Cpu className="size-5 text-foreground/70" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">CPU & System Memory</h4>
                        <p className="text-xs text-muted-foreground font-mono">{specs.cpu}</p>
                        <p className="text-sm font-medium text-foreground">{specs.ramGb} GB RAM</p>
                      </div>
                    </SettingsCard>

                    {/* GPU & VRAM Card */}
                    <SettingsCard className="p-4 flex gap-4 items-start">
                      <div className="p-2 rounded-xl bg-foreground/[0.04]">
                        <HardDrive className="size-5 text-foreground/70" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">GPU & Video Memory</h4>
                        <p className="text-xs text-muted-foreground font-mono">{specs.gpu}</p>
                        <p className="text-sm font-medium text-foreground">
                          {specs.vramMb > 0 ? `${(specs.vramMb / 1024).toFixed(1)} GB VRAM` : 'No Dedicated VRAM Detected'}
                        </p>
                      </div>
                    </SettingsCard>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex gap-3 items-center">
                    <AlertTriangle className="size-5 shrink-0" />
                    Failed to run system diagnostics check.
                  </div>
                )}
              </SettingsSection>

              {/* Local Model Cookbook */}
              <SettingsSection
                title="Model Cookbook Recommendations"
                description="Hardware compatibility mapping for running local open-source models via Ollama."
              >
                <div className="space-y-3">
                  {LOCAL_MODELS.map((model) => {
                    const comp = getCompatibility(model)
                    return (
                      <SettingsCard key={model.name} className="p-4 flex flex-col md:flex-row justify-between gap-4 md:items-center">
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{model.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground/[0.06] font-accent text-muted-foreground font-bold">
                              {model.size} Params
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {model.description}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-start md:items-end">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full font-medium ${comp.color}`}>
                            {comp.icon}
                            {comp.text}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            Requires: {model.requiredVram}GB VRAM / {model.requiredRam}GB RAM
                          </span>
                        </div>
                      </SettingsCard>
                    )
                  })}
                </div>
              </SettingsSection>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
