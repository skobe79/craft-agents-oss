import { Dithering } from '@paper-design/shaders-react'

export interface BrowserShaderProps {
  className?: string
  rounded?: boolean
  borderRadius?: string
  maskImage: string
  opacity?: number

  // TurnCard+HDR shader params
  colorBack?: string
  colorFront?: string
  shape?: 'warp' | 'simplex' | 'dots' | 'wave' | 'ripple' | 'swirl' | 'sphere'
  type?: '2x2' | '4x4' | '8x8' | 'random'
  size?: number
  speed?: number
  scale?: number
  maxPixelCount?: number
  minPixelRatio?: number
}

export function BrowserShader({
  className,
  rounded = false,
  borderRadius = '8px',
  maskImage,
  opacity = 0.85,
  colorBack = 'rgba(0,0,0,0)',
  colorFront = '#35d7ff',
  shape = 'warp',
  type = '4x4',
  size = 2,
  speed = 0.55,
  scale = 0.78,
  maxPixelCount = 350000,
  minPixelRatio = 1,
}: BrowserShaderProps) {
  return (
    <div
      className={`${className ?? ''} ${rounded ? 'overflow-hidden' : ''}`.trim()}
      style={{
        opacity,
        borderRadius: rounded ? borderRadius : 0,
        WebkitMaskImage: maskImage,
        maskImage,
      }}
    >
      <Dithering
        width="100%"
        height="100%"
        colorBack={colorBack}
        colorFront={colorFront}
        shape={shape}
        type={type}
        size={size}
        speed={speed}
        scale={scale}
        maxPixelCount={maxPixelCount}
        minPixelRatio={minPixelRatio}
      />
    </div>
  )
}
