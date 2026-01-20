import { useState, useEffect } from 'react'

/**
 * Detects if the device has hardware GPU acceleration.
 * Returns false for software renderers like SwiftShader, llvmpipe, etc.
 * This helps disable GPU-intensive effects on low-end devices.
 */
export function useHasHardwareGPU(): boolean {
  const [hasHardwareGPU, setHasHardwareGPU] = useState(true)

  useEffect(() => {
    // Known software renderer patterns (lowercase for comparison)
    const SOFTWARE_RENDERERS = [
      'swiftshader',                    // Chrome's software fallback
      'llvmpipe',                       // Linux Mesa software renderer
      'software',                       // Generic software renderer
      'microsoft basic render driver',  // Windows without GPU drivers
    ]

    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

      if (!gl) {
        // No WebGL at all - definitely no GPU
        setHasHardwareGPU(false)
        return
      }

      // Try to get the actual renderer info
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        const rendererLower = renderer.toLowerCase()

        // Check if renderer matches any known software renderer
        const isSoftware = SOFTWARE_RENDERERS.some(sw => rendererLower.includes(sw))
        setHasHardwareGPU(!isSoftware)
      }
      // If extension not available, assume hardware GPU (conservative approach)
    } catch {
      // On error, assume hardware GPU to avoid breaking the effect
      setHasHardwareGPU(true)
    }
  }, [])

  return hasHardwareGPU
}
