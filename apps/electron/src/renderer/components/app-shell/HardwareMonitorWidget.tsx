import React, { useEffect, useState } from 'react'
import { Cpu, Activity } from 'lucide-react'
import type { SystemSpecs } from '../../../shared/types'

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
  
  // Try to parse out the GPU name cleanly
  const gpuName = specs.gpu.name || 'Unknown GPU'
  const cpuName = specs.cpu.model || 'Unknown CPU'
  
  // Format RAM nicely
  const totalRamGb = Math.round(specs.memory.total / (1024 * 1024 * 1024))
  const freeRamGb = Math.round(specs.memory.free / (1024 * 1024 * 1024))
  const usedRamGb = totalRamGb - freeRamGb
  const ramPercent = Math.round((usedRamGb / totalRamGb) * 100)

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card/50 p-3 shadow-sm mx-1 mb-2">
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
          <span className="font-medium">{usedRamGb}GB / {totalRamGb}GB</span>
        </div>
        
        {/* Memory progress bar */}
        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-0.5">
          <div 
            className="h-full bg-primary" 
            style={{ width: `${ramPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
