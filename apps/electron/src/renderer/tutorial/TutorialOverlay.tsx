/**
 * Tutorial Overlay
 *
 * Full-screen overlay with spotlight effect and positioned tooltip.
 * Renders when a tutorial is running and target element is found.
 *
 * Features:
 * - SVG mask for spotlight cutout (transparent area over target)
 * - Glow ring around spotlight
 * - Animated tooltip with arrow
 * - Click on spotlight executes underlying action and advances tutorial
 * - Visual feedback (green success animation) on step completion
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Sparkles } from 'lucide-react'
import { useTutorial } from './TutorialContext'
import { cn } from '@/lib/utils'
import type { TooltipPosition } from './types'

/**
 * Spring animation preset for snappy UI
 */
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
}

/**
 * Calculate tooltip position styles based on target rect and desired position
 */
function getTooltipStyles(
  targetRect: DOMRect,
  position: TooltipPosition,
  padding: number
): React.CSSProperties {
  const gap = 16 // Space between spotlight and tooltip
  const tooltipWidth = 280

  // Calculate spotlight bounds
  const spotlightLeft = targetRect.left - padding
  const spotlightTop = targetRect.top - padding
  const spotlightRight = targetRect.right + padding
  const spotlightBottom = targetRect.bottom + padding
  const spotlightCenterX = spotlightLeft + (spotlightRight - spotlightLeft) / 2
  const spotlightCenterY = spotlightTop + (spotlightBottom - spotlightTop) / 2

  switch (position) {
    case 'top':
      return {
        left: Math.max(16, spotlightCenterX - tooltipWidth / 2),
        bottom: window.innerHeight - spotlightTop + gap,
      }
    case 'bottom':
      return {
        left: Math.max(16, spotlightCenterX - tooltipWidth / 2),
        top: spotlightBottom + gap,
      }
    case 'left':
      return {
        right: window.innerWidth - spotlightLeft + gap,
        top: spotlightCenterY - 60,
      }
    case 'right':
      return {
        left: spotlightRight + gap,
        top: spotlightCenterY - 60,
      }
    case 'center':
    default:
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }
  }
}

/**
 * Arrow component pointing from tooltip to target
 */
function TooltipArrow({ position }: { position: TooltipPosition }) {
  const arrowClasses = cn(
    'absolute w-3 h-3 bg-background border border-border/50 rotate-45',
    position === 'top' && 'bottom-[-7px] left-1/2 -translate-x-1/2 border-t-0 border-l-0',
    position === 'bottom' && 'top-[-7px] left-1/2 -translate-x-1/2 border-b-0 border-r-0',
    position === 'left' && 'right-[-7px] top-1/2 -translate-y-1/2 border-l-0 border-b-0',
    position === 'right' && 'left-[-7px] top-1/2 -translate-y-1/2 border-r-0 border-t-0'
  )

  if (position === 'center') return null

  return <div className={arrowClasses} />
}

/**
 * Cool green success animation shown when step completes
 */
function SuccessAnimation({
  x,
  y,
  width,
  height,
  radius,
  onComplete,
}: {
  x: number
  y: number
  width: number
  height: number
  radius: number
  onComplete: () => void
}) {
  const centerX = x + width / 2
  const centerY = y + height / 2

  return (
    <>
      {/* Expanding ring effect */}
      <motion.div
        className="absolute pointer-events-none border-2 border-emerald-400"
        style={{
          left: x,
          top: y,
          width,
          height,
          borderRadius: radius,
        }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.3, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Second ring with delay */}
      <motion.div
        className="absolute pointer-events-none border border-emerald-300"
        style={{
          left: x,
          top: y,
          width,
          height,
          borderRadius: radius,
        }}
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      />

      {/* Glowing background */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: x,
          top: y,
          width,
          height,
          borderRadius: radius,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(52, 211, 153, 0.2) 100%)',
          boxShadow: '0 0 40px rgba(16, 185, 129, 0.5), inset 0 0 20px rgba(52, 211, 153, 0.3)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.5, times: [0, 0.3, 1] }}
        onAnimationComplete={onComplete}
      />

      {/* Center checkmark with particles */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: centerX - 24,
          top: centerY - 24,
          width: 48,
          height: 48,
        }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/50">
          <Check className="w-6 h-6 text-white" strokeWidth={3} />
        </div>
      </motion.div>

      {/* Sparkle particles */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2
        const distance = 50
        const endX = Math.cos(angle) * distance
        const endY = Math.sin(angle) * distance

        return (
          <motion.div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: centerX - 6,
              top: centerY - 6,
              width: 12,
              height: 12,
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: endX,
              y: endY,
              scale: [0, 1, 0],
              opacity: [1, 1, 0]
            }}
            transition={{
              duration: 0.5,
              delay: 0.1 + i * 0.03,
              ease: 'easeOut'
            }}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </motion.div>
        )
      })}
    </>
  )
}

export function TutorialOverlay() {
  const { state, currentStep, currentTutorial, completeStep, skipTutorial } = useTutorial()
  const [showSuccess, setShowSuccess] = useState(false)
  const [successPosition, setSuccessPosition] = useState<{
    x: number
    y: number
    width: number
    height: number
    radius: number
  } | null>(null)

  /**
   * Handle click on spotlight area
   * - Shows success animation FIRST
   * - Completes the step after animation
   * - Then triggers the underlying element's click (which may navigate away)
   */
  const handleSpotlightClick = useCallback(() => {
    if (!currentStep || !state.targetRect || showSuccess) return

    const padding = currentStep.spotlightPadding ?? 8
    const radius = currentStep.spotlightRadius ?? 8

    // Store position for success animation
    setSuccessPosition({
      x: state.targetRect.left - padding,
      y: state.targetRect.top - padding,
      width: state.targetRect.width + padding * 2,
      height: state.targetRect.height + padding * 2,
      radius,
    })

    // Store target selector to click after animation
    const targetSelector = currentStep.target

    // Show success animation first
    setShowSuccess(true)

    // After animation duration, complete step and trigger click
    const ANIMATION_DURATION = 500
    setTimeout(() => {
      console.log('[Tutorial] Animation complete - advancing step and triggering click')

      // Complete the step (advances tutorial state)
      completeStep()

      // Find and click the underlying element
      const target = document.querySelector(targetSelector) as HTMLElement
      if (target) {
        target.click()
        // Also focus if it's an input/textarea
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          target.focus()
        }
      }
    }, ANIMATION_DURATION)
  }, [currentStep, state.targetRect, completeStep, showSuccess])

  /**
   * Called when success animation completes
   * Note: Step progression now happens in handleSpotlightClick, not here
   */
  const handleSuccessComplete = useCallback(() => {
    setShowSuccess(false)
    setSuccessPosition(null)
  }, [])

  // Only render when running and we have a target
  if (state.status !== 'running' || !currentStep || !state.targetRect) {
    return null
  }

  const { targetRect } = state
  const padding = currentStep.spotlightPadding ?? 8
  const radius = currentStep.spotlightRadius ?? 8

  // Calculate spotlight dimensions
  const spotlightX = targetRect.left - padding
  const spotlightY = targetRect.top - padding
  const spotlightWidth = targetRect.width + padding * 2
  const spotlightHeight = targetRect.height + padding * 2

  // Calculate tooltip position
  const tooltipStyles = getTooltipStyles(targetRect, currentStep.position, padding)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998] pointer-events-none">
        {/* Backdrop with spotlight cutout using SVG mask */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White = visible backdrop */}
              <rect width="100%" height="100%" fill="white" />
              {/* Black = transparent spotlight area */}
              <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightWidth}
                height={spotlightHeight}
                rx={radius}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#tutorial-spotlight-mask)"
          />
        </motion.svg>

        {/* Spotlight glow ring */}
        {!showSuccess && (
          <motion.div
            className="absolute pointer-events-none border-2 border-accent/60 shadow-[0_0_24px_rgba(var(--accent-rgb,99,102,241),0.4)]"
            style={{
              left: spotlightX,
              top: spotlightY,
              width: spotlightWidth,
              height: spotlightHeight,
              borderRadius: radius,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={springTransition}
          />
        )}

        {/* Success animation */}
        {showSuccess && successPosition && (
          <SuccessAnimation
            x={successPosition.x}
            y={successPosition.y}
            width={successPosition.width}
            height={successPosition.height}
            radius={successPosition.radius}
            onComplete={handleSuccessComplete}
          />
        )}

        {/* Tooltip */}
        {!showSuccess && (
          <motion.div
            className="absolute pointer-events-auto"
            style={tooltipStyles}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ ...springTransition, delay: 0.1 }}
          >
            <div className="relative bg-background/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-xl p-4 w-[280px]">
              {/* Arrow */}
              {currentStep.showArrow && <TooltipArrow position={currentStep.position} />}

              {/* Content */}
              <h3 className="font-semibold text-sm mb-1.5">{currentStep.title}</h3>
              <p className="text-sm text-foreground/70 mb-4 leading-relaxed">
                {currentStep.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <button
                  onClick={skipTutorial}
                  className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  Skip tutorial
                </button>
                <div className="flex items-center gap-1.5">
                  {currentTutorial?.steps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'w-1.5 h-1.5 rounded-full transition-colors',
                        index === state.currentStepIndex
                          ? 'bg-accent'
                          : index < state.currentStepIndex
                            ? 'bg-emerald-500'
                            : 'bg-foreground/10'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Clickable spotlight area - executes action and advances tutorial */}
        {!showSuccess && (
          <motion.div
            className="absolute pointer-events-auto cursor-pointer"
            style={{
              left: spotlightX,
              top: spotlightY,
              width: spotlightWidth,
              height: spotlightHeight,
              borderRadius: radius,
            }}
            onClick={handleSpotlightClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </div>
    </AnimatePresence>
  )
}
