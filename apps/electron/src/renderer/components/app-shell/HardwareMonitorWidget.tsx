import React, { useEffect, useState } from 'react'
import { Cpu, Activity } from 'lucide-react'

interface SystemSpecs {
  cpu: string
  ramGb: number
  gpu: string
  vramMb: number
}

export function HardwareMonitorWidget() {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  
  useEffect(() => {
    // Initial fetch
    window.electronAPI.getSystemSpecs().then(setSpecs).catch(console.error)
    
    // Refresh every 10 seconds (or more if needed)
    const interval = setInterval(() => {
      window.electronAPI.getSystemSpecs().then(setSpecs).catch(console.error)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])
  
  if (!specs) return null
  
  // Try to parse out the GPU/CPU name cleanly
  const gpuName = specs.gpu || 'Unknown GPU'
  const cpuName = specs.cpu || 'Unknown CPU'
  
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card/50 p-3 shadow-minimal mx-1 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span>System</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate max-w-[80px]" title={cpuName}>CPU</span>
          <span className="font-medium truncate pl-2">{cpuName.split(' ')[0]}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate max-w-[80px]" title={gpuName}>GPU</span>
          <span className="font-medium truncate pl-2" title={gpuName}>{gpuName.split(' ')[0]}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">RAM</span>
          <span className="font-medium">{specs.ramGb}GB</span>
        </div>
        
        {specs.vramMb > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">VRAM</span>
            <span className="font-medium">{Math.round(specs.vramMb / 1024)}GB</span>
          </div>
        )}
      </div>
    </div>
  )
}
