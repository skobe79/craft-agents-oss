import { useState } from 'react'
import * as Icons from 'lucide-react'
import type { ComponentEntry } from './types'
import { BrowserShader, TurnCard, type ActivityItem, type ResponseContent } from '@craft-agent/ui'
import { AnimatePresence, motion } from 'motion/react'
import { TopBarButton } from '@/components/ui/TopBarButton'
import { isMac } from '@/lib/platform'
import { BROWSER_LIVE_FX } from '../../../shared/browser-live-fx'

interface BrowserTraceSidebarSampleProps {
  scenario: 'core' | 'all-native-tools' | 'browser-tool-wrapper' | 'full-matrix'
  runState: 'completed' | 'running' | 'failed'
  sidebarWidth: number
  hdrEffect: boolean
  cursorPulse: boolean
}

type RunState = BrowserTraceSidebarSampleProps['runState']
type Scenario = BrowserTraceSidebarSampleProps['scenario']

const now = Date.now()

const CORE_TURN: ActivityItem[] = [
  {
    id: 'browser-open-1',
    type: 'tool',
    status: 'completed',
    toolName: 'browser_open',
    toolInput: {},
    intent: 'Open in-app browser window',
    timestamp: now - 5000,
  },
  {
    id: 'browser-navigate-1',
    type: 'tool',
    status: 'completed',
    toolName: 'browser_navigate',
    toolInput: { url: 'https://news.ycombinator.com' },
    intent: 'Navigate to Hacker News',
    timestamp: now - 4200,
  },
  {
    id: 'browser-snapshot-1',
    type: 'tool',
    status: 'completed',
    toolName: 'browser_snapshot',
    toolInput: {},
    intent: 'Get accessibility refs for interactive elements',
    timestamp: now - 3500,
  },
  {
    id: 'browser-click-1',
    type: 'tool',
    status: 'completed',
    toolName: 'browser_click',
    toolInput: { ref: '@e12' },
    intent: 'Open top story',
    timestamp: now - 3000,
  },
  {
    id: 'browser-screenshot-1',
    type: 'tool',
    status: 'completed',
    toolName: 'browser_screenshot',
    toolInput: { mode: 'agent', refs: ['@e12'], includeMetadata: true },
    intent: 'Capture agent-mode screenshot with semantic annotation',
    timestamp: now - 2500,
  },
]

const ALL_NATIVE_TOOLS_TURN: ActivityItem[] = [
  { id: 'native-open', type: 'tool', status: 'completed', toolName: 'browser_open', toolInput: {}, intent: 'Open browser window', timestamp: now - 5200 },
  { id: 'native-navigate', type: 'tool', status: 'completed', toolName: 'browser_navigate', toolInput: { url: 'https://example.com' }, intent: 'Navigate to target URL', timestamp: now - 4900 },
  { id: 'native-snapshot', type: 'tool', status: 'completed', toolName: 'browser_snapshot', toolInput: {}, intent: 'Capture a11y tree refs', timestamp: now - 4600 },
  { id: 'native-click', type: 'tool', status: 'completed', toolName: 'browser_click', toolInput: { ref: '@e12' }, intent: 'Click interactive element', timestamp: now - 4300 },
  { id: 'native-fill', type: 'tool', status: 'completed', toolName: 'browser_fill', toolInput: { ref: '@e5', value: 'balint@example.com' }, intent: 'Fill input field', timestamp: now - 4000 },
  { id: 'native-select', type: 'tool', status: 'completed', toolName: 'browser_select', toolInput: { ref: '@e9', value: 'pro' }, intent: 'Select dropdown option', timestamp: now - 3700 },
  { id: 'native-scroll', type: 'tool', status: 'completed', toolName: 'browser_scroll', toolInput: { direction: 'down', amount: 800 }, intent: 'Scroll for more content', timestamp: now - 3400 },
  { id: 'native-back', type: 'tool', status: 'completed', toolName: 'browser_back', toolInput: {}, intent: 'Navigate back in history', timestamp: now - 3100 },
  { id: 'native-forward', type: 'tool', status: 'completed', toolName: 'browser_forward', toolInput: {}, intent: 'Navigate forward in history', timestamp: now - 2800 },
  { id: 'native-evaluate', type: 'tool', status: 'completed', toolName: 'browser_evaluate', toolInput: { expression: 'document.title' }, intent: 'Run JS extraction in page context', timestamp: now - 2500 },
  { id: 'native-screenshot', type: 'tool', status: 'completed', toolName: 'browser_screenshot', toolInput: { mode: 'agent', includeMetadata: true }, intent: 'Capture visual proof with metadata', timestamp: now - 2200 },
]

const WRAPPER_COMMANDS_TURN: ActivityItem[] = [
  { id: 'wrapper-open', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'open' }, intent: 'Wrapper: open browser', timestamp: now - 4200 },
  { id: 'wrapper-navigate', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'navigate https://example.com' }, intent: 'Wrapper: navigate to URL', timestamp: now - 3900 },
  { id: 'wrapper-snapshot', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'snapshot' }, intent: 'Wrapper: list refs', timestamp: now - 3600 },
  { id: 'wrapper-fill', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'fill @e5 hello@craft.do' }, intent: 'Wrapper: fill text field', timestamp: now - 3300 },
  { id: 'wrapper-click', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'click @e8' }, intent: 'Wrapper: click target', timestamp: now - 3000 },
  { id: 'wrapper-scroll', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'scroll down 600' }, intent: 'Wrapper: scroll viewport', timestamp: now - 2700 },
  { id: 'wrapper-evaluate', type: 'tool', status: 'completed', toolName: 'browser_tool', toolInput: { command: 'evaluate document.title' }, intent: 'Wrapper: evaluate expression', timestamp: now - 2400 },
]

function applyRunState(activities: ActivityItem[], runState: RunState): ActivityItem[] {
  if (runState === 'completed') return activities

  return activities.map((activity, index) => {
    if (runState === 'running' && index === activities.length - 1) {
      return { ...activity, status: 'running' }
    }
    if (runState === 'failed' && index === activities.length - 1) {
      return { ...activity, status: 'error' }
    }
    return { ...activity, status: 'completed' }
  })
}

function getScenarioTurns(scenario: Scenario): ActivityItem[][] {
  switch (scenario) {
    case 'core':
      return [CORE_TURN]
    case 'all-native-tools':
      return [ALL_NATIVE_TOOLS_TURN]
    case 'browser-tool-wrapper':
      return [WRAPPER_COMMANDS_TURN]
    case 'full-matrix':
      return [ALL_NATIVE_TOOLS_TURN, WRAPPER_COMMANDS_TURN]
    default:
      return [CORE_TURN]
  }
}

function getScenarioResponse(scenario: Scenario, runState: RunState): ResponseContent {
  if (runState === 'failed') {
    return {
      text: 'One browser action failed in this turn. Verify refs/inputs and retry.',
      isStreaming: false,
    }
  }

  if (runState === 'running') {
    return {
      text: 'Browser action in progress… waiting for completion.',
      isStreaming: true,
    }
  }

  return {
    text: scenario === 'full-matrix'
      ? 'Rendered all native browser_* tools and browser_tool wrapper command flows.'
      : 'Rendered browser tool flow for this scenario.',
    isStreaming: false,
  }
}

function getLiveFxPayload(scenario: Scenario, runState: RunState): { active: boolean; label: string; cursor: { x: number; y: number } | null } {
  if (runState === 'failed') {
    return {
      active: true,
      label: 'Action failed — verify refs and retry',
      cursor: null,
    }
  }

  if (runState === 'running') {
    const cursorByScenario: Record<Scenario, { x: number; y: number } | null> = {
      core: { x: 296, y: 252 },
      'all-native-tools': { x: 426, y: 214 },
      'browser-tool-wrapper': { x: 342, y: 304 },
      'full-matrix': { x: 382, y: 246 },
    }

    return {
      active: true,
      label: 'Craft Agent is working…',
      cursor: cursorByScenario[scenario],
    }
  }

  return {
    active: false,
    label: '',
    cursor: null,
  }
}

function BrowserMockPageSurface({ className }: { className?: string }) {
  return (
    <div className={className ?? 'absolute inset-0 p-6 z-10'}>
      <div className="h-10 rounded-lg border border-foreground/10 bg-background/80 backdrop-blur-sm" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="h-24 rounded-lg bg-foreground/5" />
        <div className="h-24 rounded-lg bg-foreground/5" />
        <div className="h-24 rounded-lg bg-foreground/5" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-[70%] rounded bg-foreground/10" />
        <div className="h-4 w-[85%] rounded bg-foreground/8" />
        <div className="h-4 w-[60%] rounded bg-foreground/10" />
      </div>
    </div>
  )
}

function BrowserEdgeShaderFx({ className = 'absolute inset-0 pointer-events-none z-20', rounded = false }: { className?: string; rounded?: boolean }) {
  return (
    <BrowserShader
      className={className}
      rounded={rounded}
      borderRadius={BROWSER_LIVE_FX.borderRadius}
      maskImage={BROWSER_LIVE_FX.borderMaskImage}
      opacity={0.85}
      colorBack="rgba(0,0,0,0)"
      colorFront="#35d7ff"
      shape="warp"
      type="4x4"
      size={2}
      speed={0.55}
      scale={0.78}
      maxPixelCount={350000}
      minPixelRatio={1}
    />
  )
}

function BrowserTraceSidebarSample({ scenario, runState, sidebarWidth, hdrEffect, cursorPulse }: BrowserTraceSidebarSampleProps) {
  const turns = getScenarioTurns(scenario).map((items, index) => applyRunState(items, runState))

  return (
    <div className="w-full h-[700px] rounded-xl border border-border overflow-hidden bg-background shadow-sm flex">
      <div className="flex-1 relative overflow-hidden">
        {/* Base placeholder browser content */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />

        {/* Shared edge shader effect (same visual as Browser Frame overlay) */}
        {hdrEffect && <BrowserEdgeShaderFx className="absolute inset-0 pointer-events-none z-20" />}

        {/* Cursor pulse simulation */}
        {cursorPulse && (
          <>
            <motion.div
              className="absolute h-6 w-5 z-30 [will-change:transform]"
              style={{ transform: 'translateZ(0)' }}
              initial={false}
              animate={{ x: [220, 300, 430, 330, 220], y: [180, 260, 240, 350, 180], rotate: [0, 2, -3, 1, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="h-full w-full bg-black shadow-[0_0_12px_rgba(0,0,0,0.35)]"
                style={{
                  clipPath: 'polygon(0% 0%, 0% 100%, 34% 73%, 51% 100%, 66% 94%, 48% 67%, 100% 67%)',
                  borderRadius: '2px',
                  outline: '1px solid rgba(255,255,255,0.75)',
                }}
              />
            </motion.div>
            <motion.div
              className="absolute h-10 w-10 rounded-full border-2 border-cyan-400/65 z-30 [will-change:transform,opacity]"
              style={{ transform: 'translateZ(0)' }}
              initial={{ x: 213, y: 173, opacity: 0.75, scale: 0.55 }}
              animate={{ x: [213, 293, 423, 323, 213], y: [173, 253, 233, 343, 173], opacity: [0.68, 0.16, 0.68, 0.16, 0.68], scale: [0.6, 1.5, 0.6, 1.5, 0.6] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        <BrowserMockPageSurface />
      </div>

      <div
        className="h-full border-l border-border bg-background/95 backdrop-blur-sm overflow-y-auto p-3 space-y-3"
        style={{ width: `${sidebarWidth}px` }}
      >
        {turns.map((activities, index) => {
          const isRunning = runState === 'running' && index === turns.length - 1
          const response = getScenarioResponse(scenario, runState)

          return (
            <TurnCard
              key={`browser-trace-turn-${index + 1}`}
              sessionId="playground-browser-session"
              turnId={`browser-trace-turn-${index + 1}`}
              activities={activities}
              response={response}
              intent={index === 0 ? 'Tool execution trace' : 'Wrapper command trace'}
              isStreaming={isRunning}
              isComplete={!isRunning}
              onOpenFile={(path) => console.log('[Playground] Open file:', path)}
              onOpenUrl={(url) => console.log('[Playground] Open URL:', url)}
              compactMode={true}
            />
          )
        })}
      </div>
    </div>
  )
}

function BrowserFramePlayground({
  initialUrl,
  loading,
  scenario,
  runState,
  showToolTrace,
  sidebarWidth,
}: {
  initialUrl: string
  loading: boolean
  scenario: Scenario
  runState: RunState
  showToolTrace: boolean
  sidebarWidth: number
}) {
  const [url, setUrl] = useState(initialUrl)
  const [isUrlFocused, setIsUrlFocused] = useState(false)
  const turns = getScenarioTurns(scenario).map((items) => applyRunState(items, runState))
  const effectiveLoading = loading || runState === 'running'
  const stoplightInset = isMac ? 86 : 0
  const liveFx = getLiveFxPayload(scenario, runState)

  return (
    <div className="w-full h-[700px] rounded-xl border border-border overflow-hidden bg-background shadow-sm flex">
      <div className="flex-1 min-w-0">
        <div className="relative h-[48px] border-b border-foreground/6 px-3 flex items-center gap-1">
          <div className="shrink-0" style={{ width: stoplightInset }} />
          <TopBarButton aria-label="Back">
            <Icons.ChevronLeft className="h-[18px] w-[18px] text-foreground/70" strokeWidth={1.5} />
          </TopBarButton>
          <TopBarButton aria-label="Forward">
            <Icons.ChevronRight className="h-[18px] w-[18px] text-foreground/70" strokeWidth={1.5} />
          </TopBarButton>
          <TopBarButton aria-label={effectiveLoading ? 'Stop loading' : 'Reload'}>
            {effectiveLoading ? (
              <Icons.X className="h-[16px] w-[16px] text-foreground/70" strokeWidth={1.8} />
            ) : (
              <Icons.RotateCcw className="h-[15px] w-[15px] text-foreground/70" strokeWidth={1.8} />
            )}
          </TopBarButton>
          <form
            className="flex-1 min-w-[220px]"
            onSubmit={(e) => {
              e.preventDefault()
            }}
          >
            <div className={`h-[30px] rounded-[8px] transition-all ${isUrlFocused ? 'bg-background border border-transparent shadow-minimal' : 'bg-transparent border border-foreground/5'}`}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setIsUrlFocused(true)}
                onBlur={() => setIsUrlFocused(false)}
                className="w-full h-full rounded-[8px] bg-transparent px-3 text-[13px] text-foreground/70 outline-none"
              />
            </div>
          </form>
          <div className="ml-2 max-w-[220px] truncate text-[11px] text-foreground/50">Browser Frame Playground</div>
          <AnimatePresence>
            {effectiveLoading && (
              <motion.div
                className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent"
                style={{ backgroundSize: '220% 100%' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9, backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 0.2, ease: 'easeOut' },
                  backgroundPosition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="h-[calc(100%-48px)] bg-gradient-to-br from-slate-100/70 to-slate-200/70 dark:from-slate-900/70 dark:to-slate-950/70 p-4">
          <div className="relative h-full w-full rounded-lg border border-foreground/10 bg-background/80 overflow-hidden">
            <BrowserMockPageSurface className="absolute inset-0 p-6" />

            <AnimatePresence>
              {liveFx.active && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <BrowserEdgeShaderFx className="absolute inset-0" rounded />

                  <div
                    className="absolute text-[11px]"
                    style={{
                      top: BROWSER_LIVE_FX.chipTop,
                      right: BROWSER_LIVE_FX.chipRight,
                      padding: BROWSER_LIVE_FX.chipPadding,
                      borderRadius: BROWSER_LIVE_FX.chipRadius,
                      font: BROWSER_LIVE_FX.chipFont,
                      background: BROWSER_LIVE_FX.chipBackground,
                      color: BROWSER_LIVE_FX.chipColor,
                      backdropFilter: BROWSER_LIVE_FX.chipBackdropFilter,
                    }}
                  >
                    {liveFx.label}
                  </div>

                  {liveFx.cursor && (
                    <motion.div
                      className="absolute"
                      style={{
                        width: BROWSER_LIVE_FX.cursorWidth,
                        height: BROWSER_LIVE_FX.cursorHeight,
                        left: liveFx.cursor.x - BROWSER_LIVE_FX.cursorOffset,
                        top: liveFx.cursor.y - BROWSER_LIVE_FX.cursorOffset,
                        filter: BROWSER_LIVE_FX.cursorFilter,
                      }}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    >
                      <div
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{ __html: BROWSER_LIVE_FX.cursorInnerHtml }}
                      />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showToolTrace && (
        <div
          className="h-full border-l border-border bg-background/95 backdrop-blur-sm overflow-y-auto p-3 space-y-3"
          style={{ width: `${sidebarWidth}px` }}
        >
          {turns.map((activities, index) => {
            const isRunning = runState === 'running' && index === turns.length - 1
            const response = getScenarioResponse(scenario, runState)

            return (
              <TurnCard
                key={`browser-frame-turn-${index + 1}`}
                sessionId="playground-browser-session"
                turnId={`browser-frame-turn-${index + 1}`}
                activities={activities}
                response={response}
                intent={index === 0 ? 'Tool execution trace' : 'Wrapper command trace'}
                isStreaming={isRunning}
                isComplete={!isRunning}
                onOpenFile={(path) => console.log('[Playground] Open file:', path)}
                onOpenUrl={(url) => console.log('[Playground] Open URL:', url)}
                compactMode={true}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export const browserUiComponents: ComponentEntry[] = [
  {
    id: 'browser-frame-playground',
    name: 'Browser Frame (Dedicated Controls)',
    category: 'Browser',
    description: 'Dedicated always-visible browser controls frame for iterating visual design before wiring to native window.',
    component: BrowserFramePlayground,
    layout: 'top',
    props: [
      {
        name: 'initialUrl',
        description: 'Initial URL value shown in the address field.',
        control: { type: 'string' },
        defaultValue: 'https://www.iana.org/help',
      },
      {
        name: 'loading',
        description: 'Show Stop vs Reload button state.',
        control: { type: 'boolean' },
        defaultValue: false,
      },
      {
        name: 'showToolTrace',
        description: 'Show browser tool execution trace next to the frame.',
        control: { type: 'boolean' },
        defaultValue: true,
      },
      {
        name: 'scenario',
        description: 'Choose which browser tool capability set to preview.',
        control: {
          type: 'select',
          options: [
            { label: 'Core Flow', value: 'core' },
            { label: 'All Native browser_* Tools', value: 'all-native-tools' },
            { label: 'browser_tool Wrapper Commands', value: 'browser-tool-wrapper' },
            { label: 'Full Matrix (Native + Wrapper)', value: 'full-matrix' },
          ],
        },
        defaultValue: 'full-matrix',
      },
      {
        name: 'runState',
        description: 'Preview completed, running, and failed activity rendering states.',
        control: {
          type: 'select',
          options: [
            { label: 'Completed', value: 'completed' },
            { label: 'Running', value: 'running' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        defaultValue: 'completed',
      },
      {
        name: 'sidebarWidth',
        description: 'Width of tool trace sidebar in pixels when visible.',
        control: { type: 'number', min: 280, max: 520, step: 10 },
        defaultValue: 360,
      },
    ],
  },
  {
    id: 'browser-trace-sidebar-sample',
    name: 'Browser Trace Sidebar (TurnCard + HDR)',
    category: 'Browser',
    description: 'Browser UI sample with placeholder page, HDR animated glow, cursor pulse, and in-window TurnCard trace sidebar.',
    component: BrowserTraceSidebarSample,
    layout: 'full',
    props: [
      {
        name: 'scenario',
        description: 'Choose which browser tool capability set to preview.',
        control: {
          type: 'select',
          options: [
            { label: 'Core Flow', value: 'core' },
            { label: 'All Native browser_* Tools', value: 'all-native-tools' },
            { label: 'browser_tool Wrapper Commands', value: 'browser-tool-wrapper' },
            { label: 'Full Matrix (Native + Wrapper)', value: 'full-matrix' },
          ],
        },
        defaultValue: 'full-matrix',
      },
      {
        name: 'runState',
        description: 'Preview completed, running, and failed activity rendering states.',
        control: {
          type: 'select',
          options: [
            { label: 'Completed', value: 'completed' },
            { label: 'Running', value: 'running' },
            { label: 'Failed', value: 'failed' },
          ],
        },
        defaultValue: 'completed',
      },
      {
        name: 'sidebarWidth',
        description: 'Width of the trace sidebar in pixels.',
        control: { type: 'number', min: 280, max: 520, step: 10 },
        defaultValue: 360,
      },
      {
        name: 'hdrEffect',
        description: 'Enable animated HDR-like glow background layers.',
        control: { type: 'boolean' },
        defaultValue: true,
      },
      {
        name: 'cursorPulse',
        description: 'Enable animated cursor pulse path over placeholder page.',
        control: { type: 'boolean' },
        defaultValue: true,
      },
    ],
  },
]
