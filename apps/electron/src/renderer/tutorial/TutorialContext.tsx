/**
 * Tutorial Context
 *
 * React context providing tutorial state management and control.
 * Handles:
 * - Tutorial state machine (idle → prompting → running → completed/skipped)
 * - Target element positioning and tracking
 * - localStorage persistence for completed/skipped tutorials
 * - Auto-triggering based on conditions
 * - Re-triggering when workspace changes
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useAtomValue } from 'jotai'
import { sourcesAtom } from '@/atoms/sources'
import * as storage from '@/lib/local-storage'
import type {
  TutorialState,
  TutorialProgress,
  TutorialContextValue,
  TutorialStep,
  TutorialDefinition,
} from './types'
import { getTutorial } from './registry'

const STORAGE_KEY = storage.KEYS.tutorialProgress

/**
 * Default tutorial progress
 */
const defaultProgress: TutorialProgress = {
  completedTutorials: [],
  skippedTutorials: [],
}

/**
 * Default tutorial state
 */
const defaultState: TutorialState = {
  activeTutorialId: null,
  currentStepIndex: 0,
  status: 'idle',
  targetRect: null,
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

interface TutorialProviderProps {
  children: ReactNode
  /** Current workspace ID - triggers re-evaluation when changed */
  workspaceId?: string | null
  /** Disable auto-triggering (for testing) */
  disableAutoTrigger?: boolean
}

export function TutorialProvider({
  children,
  workspaceId,
  disableAutoTrigger = false,
}: TutorialProviderProps) {
  // Read sources for trigger conditions
  const sources = useAtomValue(sourcesAtom)

  // Tutorial state
  const [state, setState] = useState<TutorialState>(defaultState)

  // Track previous workspace ID to detect changes
  const prevWorkspaceIdRef = useRef<string | null | undefined>(workspaceId)

  // Load progress from localStorage
  const [progress, setProgress] = useState<TutorialProgress>(() => {
    return storage.get(STORAGE_KEY, defaultProgress)
  })

  // Persist progress changes
  useEffect(() => {
    storage.set(STORAGE_KEY, progress)
  }, [progress])

  // Track target element position with ResizeObserver
  const observerRef = useRef<ResizeObserver | null>(null)

  // Get current tutorial and step from state
  const currentTutorial = state.activeTutorialId
    ? getTutorial(state.activeTutorialId)
    : null
  const currentStep = currentTutorial?.steps[state.currentStepIndex] ?? null

  /**
   * Reset tutorial state when workspace changes
   * This allows the auto-trigger to re-evaluate for the new workspace
   */
  useEffect(() => {
    if (prevWorkspaceIdRef.current !== workspaceId && workspaceId !== undefined) {
      // Workspace changed - reset to idle so auto-trigger can re-evaluate
      // Only reset if we're not in the middle of running a tutorial
      if (state.status === 'prompting' || state.status === 'idle') {
        setState(defaultState)
      }
      prevWorkspaceIdRef.current = workspaceId
    }
  }, [workspaceId, state.status])

  /**
   * Update target rect when step changes or during running state
   */
  useEffect(() => {
    // Only track position when running
    if (state.status !== 'running' || !currentStep) {
      setState((s) => ({ ...s, targetRect: null }))
      return
    }

    const updateTargetRect = () => {
      const target = document.querySelector(currentStep.target)
      if (target) {
        const rect = target.getBoundingClientRect()
        setState((s) => ({ ...s, targetRect: rect }))
      } else {
        // Target not found - could be not rendered yet
        setState((s) => ({ ...s, targetRect: null }))
      }
    }

    // Apply step delay if specified
    const delay = currentStep.delay ?? 0
    const delayTimer = setTimeout(() => {
      updateTargetRect()

      // Observe for size/position changes
      const target = document.querySelector(currentStep.target)
      if (target) {
        const observer = new ResizeObserver(updateTargetRect)
        observer.observe(target)
        observerRef.current = observer
      }
    }, delay)

    // Also update on scroll/resize
    window.addEventListener('scroll', updateTargetRect, true)
    window.addEventListener('resize', updateTargetRect)

    return () => {
      clearTimeout(delayTimer)
      observerRef.current?.disconnect()
      window.removeEventListener('scroll', updateTargetRect, true)
      window.removeEventListener('resize', updateTargetRect)
    }
  }, [currentStep, state.status])

  /**
   * Auto-trigger tutorials based on conditions
   * Re-evaluates when sources change or workspace changes
   */
  useEffect(() => {
    if (disableAutoTrigger) return
    // Don't trigger if already in a tutorial or prompting
    if (state.status !== 'idle') return
    // Need a valid workspace
    if (!workspaceId) return

    // Check source creation tutorial trigger
    const isSourceCreationCompleted = progress.completedTutorials.includes('source-creation')
    const isSourceCreationSkipped = progress.skippedTutorials.includes('source-creation')

    if (sources.length === 0 && !isSourceCreationCompleted && !isSourceCreationSkipped) {
      // Delay prompt slightly to let UI settle after workspace load
      const timer = setTimeout(() => {
        setState((s) => ({
          ...s,
          activeTutorialId: 'source-creation',
          status: 'prompting',
        }))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [sources.length, progress, state.status, disableAutoTrigger, workspaceId])

  /**
   * Start a tutorial by ID
   */
  const startTutorial = useCallback((tutorialId: string) => {
    const tutorial = getTutorial(tutorialId)
    if (!tutorial) {
      console.warn(`[Tutorial] Tutorial "${tutorialId}" not found`)
      return
    }

    setState({
      activeTutorialId: tutorialId,
      currentStepIndex: 0,
      status: 'running',
      targetRect: null,
    })
  }, [])

  /**
   * Move to next step
   */
  const nextStep = useCallback(() => {
    if (!currentTutorial || !state.activeTutorialId) return

    const nextIndex = state.currentStepIndex + 1

    console.log('[Tutorial] nextStep:', {
      currentStep: state.currentStepIndex,
      nextIndex,
      totalSteps: currentTutorial.steps.length,
      willComplete: nextIndex >= currentTutorial.steps.length,
      stepIds: currentTutorial.steps.map((s) => s.id),
    })

    if (nextIndex >= currentTutorial.steps.length) {
      // Tutorial complete
      setProgress((p) => ({
        ...p,
        completedTutorials: [...p.completedTutorials, state.activeTutorialId!],
      }))
      currentTutorial.onComplete?.()
      setState(defaultState)
    } else {
      setState((s) => ({ ...s, currentStepIndex: nextIndex, targetRect: null }))
    }
  }, [currentTutorial, state.currentStepIndex, state.activeTutorialId])

  /**
   * Complete current step
   */
  const completeStep = useCallback(() => {
    currentStep?.onComplete?.()
    nextStep()
  }, [currentStep, nextStep])

  /**
   * Skip/dismiss current tutorial
   */
  const skipTutorial = useCallback(() => {
    if (state.activeTutorialId) {
      setProgress((p) => ({
        ...p,
        skippedTutorials: [...p.skippedTutorials, state.activeTutorialId!],
      }))
      currentTutorial?.onSkip?.()
    }
    setState(defaultState)
  }, [state.activeTutorialId, currentTutorial])

  /**
   * Show prompt for a tutorial
   */
  const promptTutorial = useCallback((tutorialId: string) => {
    setState({
      activeTutorialId: tutorialId,
      currentStepIndex: 0,
      status: 'prompting',
      targetRect: null,
    })
  }, [])

  /**
   * Dismiss prompt without action
   */
  const dismissPrompt = useCallback(() => {
    setState(defaultState)
  }, [])

  /**
   * Check if tutorial was completed
   */
  const isTutorialCompleted = useCallback(
    (tutorialId: string) => {
      return progress.completedTutorials.includes(tutorialId)
    },
    [progress]
  )

  /**
   * Check if tutorial was skipped
   */
  const isTutorialSkipped = useCallback(
    (tutorialId: string) => {
      return progress.skippedTutorials.includes(tutorialId)
    },
    [progress]
  )

  /**
   * Reset progress for a tutorial (for testing/development)
   */
  const resetTutorial = useCallback((tutorialId: string) => {
    setProgress((p) => ({
      completedTutorials: p.completedTutorials.filter((id) => id !== tutorialId),
      skippedTutorials: p.skippedTutorials.filter((id) => id !== tutorialId),
    }))
  }, [])

  const value: TutorialContextValue = {
    state,
    currentStep,
    currentTutorial,
    startTutorial,
    nextStep,
    completeStep,
    skipTutorial,
    promptTutorial,
    dismissPrompt,
    isTutorialCompleted,
    isTutorialSkipped,
    resetTutorial,
  }

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  )
}

/**
 * Hook to access tutorial context
 */
export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider')
  }
  return context
}

/**
 * Hook to check if in tutorial mode (for conditional rendering)
 */
export function useIsTutorialActive(): boolean {
  const { state } = useTutorial()
  return state.status === 'running' || state.status === 'prompting'
}
