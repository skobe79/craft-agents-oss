import React, { useMemo } from 'react'

type MemoryNode = {
  id: string
  title: string
  class: string
  confidence: number
  x: number
  y: number
}

type MemoryGraphProps = {
  memories: any[]
  selectedId?: string
  onSelect?: (memory: any) => void
}

export function MemoryGraph({ memories, selectedId, onSelect }: MemoryGraphProps) {
  const nodes = useMemo(() => {
    const cx = 220
    const cy = 160
    const radius = 110
    return memories.map((m, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(memories.length, 1)
      return {
        id: m.id,
        title: m.title,
        class: m.class,
        confidence: m.confidence,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      } as MemoryNode
    })
  }, [memories])

  const links = useMemo(() => {
    const out: { source: MemoryNode; target: MemoryNode }[] = []
    for (let i = 0; i < nodes.length; i++) {
      const next = (i + 1) % nodes.length
      out.push({ source: nodes[i], target: nodes[next] })
      if (nodes.length > 2 && i % 2 === 0) {
        const opposite = (i + Math.floor(nodes.length / 2)) % nodes.length
        out.push({ source: nodes[i], target: nodes[opposite] })
      }
    }
    return out
  }, [nodes])

  return (
    <svg viewBox="0 0 440 320" className="memory-graph" aria-label="Memory knowledge graph">
      <defs>
        <filter id="memory-node-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <g>
        {links.map((link, idx) => (
          <line
            key={`edge-${idx}`}
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
            stroke="var(--color-border)"
            strokeWidth="1.2"
          />
        ))}
      </g>

      <g>
        {nodes.map((node) => {
          const isActive = selectedId === node.id
          const fill = isActive ? 'var(--color-accent)' : 'var(--color-surface-muted)'
          const stroke = isActive ? 'var(--color-accent)' : 'var(--color-border)'
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect?.({ id: node.id, title: node.title, class: node.class, confidence: node.confidence })}
            >
              <circle r="18" fill={fill} stroke={stroke} strokeWidth="2" />
              <text
                y="4"
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-text)"
                style={{ pointerEvents: 'none' }}
              >
                {node.class.slice(0, 2).toUpperCase()}
              </text>
            </g>
          )
        })}
      </g>

      <g>
        {nodes.map((node) => (
          <text
            key={`label-${node.id}`}
            x={node.x}
            y={node.y + 34}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text)"
            style={{ pointerEvents: 'none' }}
          >
            {node.title}
          </text>
        ))}
      </g>
    </svg>
  )
}
