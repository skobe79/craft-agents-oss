import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import { SettingsSection } from '@/components/settings'
import { Download, ExternalLink } from 'lucide-react'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'llama-cpp-cookbook',
}

interface LlamaModel {
  name: string
  creator: string
  params: string
  description: string
  hfLink: string
  downloadCommand: string
}

const MODELS: LlamaModel[] = [
  {
    name: 'Qwen 2.5 Coder 7B',
    creator: 'Qwen',
    params: '7B',
    description: 'An exceptional 7B model specifically trained for code generation, code reasoning, and debugging.',
    hfLink: 'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    downloadCommand: 'huggingface-cli download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF qwen2.5-coder-7b-instruct-q4_k_m.gguf --local-dir . --local-dir-use-symlinks False'
  },
  {
    name: 'Llama-3.1-8B-Instruct',
    creator: 'Meta',
    params: '8B',
    description: "Meta's latest 8B model with excellent general reasoning and solid coding capability.",
    hfLink: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    downloadCommand: 'huggingface-cli download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir . --local-dir-use-symlinks False'
  },
  {
    name: 'Phi-3-Mini-4k-Instruct',
    creator: 'Microsoft',
    params: '3.8B',
    description: 'A tiny but mighty model that is fast on CPUs and low VRAM GPUs, suitable for smaller tasks.',
    hfLink: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf',
    downloadCommand: 'huggingface-cli download microsoft/Phi-3-mini-4k-instruct-gguf Phi-3-mini-4k-instruct-q4.gguf --local-dir . --local-dir-use-symlinks False'
  },
  {
    name: 'Mistral-Nemo-Instruct-2407',
    creator: 'Mistral AI & NVIDIA',
    params: '12B',
    description: 'A 12B model that fits comfortably in 8GB-12GB VRAM with excellent context handling and reasoning.',
    hfLink: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF',
    downloadCommand: 'huggingface-cli download bartowski/Mistral-Nemo-Instruct-2407-GGUF Mistral-Nemo-Instruct-2407-Q4_K_M.gguf --local-dir . --local-dir-use-symlinks False'
  },
  {
    name: 'DeepSeek-Coder-V2-Lite-Instruct',
    creator: 'DeepSeek',
    params: '16B (MoE)',
    description: 'A powerful mixture-of-experts model trained extensively on code. Requires around 12GB RAM/VRAM.',
    hfLink: 'https://huggingface.co/bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF',
    downloadCommand: 'huggingface-cli download bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf --local-dir . --local-dir-use-symlinks False'
  }
]

export default function LlamaCppCookbookPage() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title={t('settings.llamaCppCookbook.title')} />
      <ScrollArea className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-4xl space-y-8 pb-12">
          
          <SettingsSection 
            title="Llama.cpp Models (GGUF)" 
            description="A curated list of high-quality GGUF models that you can run locally using llama.cpp or LM Studio. These are quantized to 4-bit (Q4_K_M) for the best balance of speed, RAM usage, and intelligence."
          >
            <div className="grid gap-4 mt-4">
              {MODELS.map((model) => (
                <div key={model.name} className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-accent">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-lg leading-none">{model.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                          {model.params}
                        </span>
                        by {model.creator}
                      </p>
                    </div>
                    <a
                      href={model.hfLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      View on HuggingFace
                    </a>
                  </div>
                  
                  <p className="text-sm text-foreground/80">{model.description}</p>
                  
                  <div className="mt-2 rounded-md bg-muted/50 p-3">
                    <div className="mb-2 flex items-center text-xs font-medium text-muted-foreground">
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download via HuggingFace CLI
                    </div>
                    <code className="block select-all rounded border bg-background px-3 py-2 text-xs text-foreground font-mono break-all">
                      {model.downloadCommand}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

        </div>
      </ScrollArea>
    </div>
  )
}
