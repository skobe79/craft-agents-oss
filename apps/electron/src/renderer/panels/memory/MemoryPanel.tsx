import React, { useState, useMemo } from 'react'
import { Brain, Search, Plus, Filter, Network, FileText, Tag, Calendar, Link2, MoreHorizontal } from 'lucide-react'
import type { AnyMemory } from '../../../../shared/src/memory/types'

type MemoryPanelProps = {
  memories?: AnyMemory[]
  onSelectMemory?: (memory: AnyMemory) => void
  onAddMemory?: () => void
  selectedMemoryId?: string
}

const MOCK_MEMORIES: AnyMemory[] = [
  {
    id: 'mem-1',
    class: 'semantic',
    title: 'User prefers dark mode',
    content: 'User consistently chooses dark theme across all apps.',
    confidence: 0.95,
    tags: ['preferences', 'ui'],
    createdAt: '2026-07-20T10:00:00Z',
    updatedAt: '2026-07-22T08:30:00Z',
    source: { sessionId: 's1', messageId: 'm1', toolCall: undefined, importOrigin: undefined },
    scope: 'user',
    scopeId: 'u1',
    sensitivity: 'internal',
    archived: false,
    supersededById: undefined,
    supersedesIds: [],
    expiry: { expiresAt: undefined, ttlDays: undefined, archiveOnSupersede: false },
  } as AnyMemory,
  {
    id: 'mem-2',
    class: 'episodic',
    title: 'Fixed build error in LayoutShell',
    content: 'Resolved TypeScript error by changing db.pragma to db.run for SQLite pragmas.',
    confidence: 0.88,
    tags: ['debug', 'typescript', 'sqlite'],
    createdAt: '2026-07-22T14:15:00Z',
    updatedAt: '2026-07-22T14:15:00Z',
    source: { sessionId: 's2', messageId: 'm2', toolCall: undefined, importOrigin: undefined },
    scope: 'project',
    scopeId: 'p1',
    sensitivity: 'internal',
    archived: false,
    supersededById: undefined,
    supersedesIds: [],
    expiry: { expiresAt: undefined, ttlDays: undefined, archiveOnSupersede: false },
  } as AnyMemory,
  {
    id: 'mem-3',
    class: 'procedural',
    title: 'Deploy workflow for Electron app',
    content: '1. Build shared package. 2. Run electron typecheck. 3. Package with electron-builder.',
    confidence: 0.92,
    tags: ['deployment', 'electron', 'workflow'],
    createdAt: '2026-07-21T09:00:00Z',
    updatedAt: '2026-07-21T09:00:00Z',
    source: { sessionId: 's3', messageId: 'm3', toolCall: undefined, importOrigin: undefined },
    scope: 'workspace',
    scopeId: 'w1',
    sensitivity: 'internal',
    archived: false,
    supersededById: undefined,
    supersedesIds: [],
    expiry: { expiresAt: undefined, ttlDays: undefined, archiveOnSupersede: false },
  } as AnyMemory,
]

export function MemoryPanel({
  memories = MOCK_MEMORIES,
  onSelectMemory,
  onAddMemory,
  selectedMemoryId,
}: MemoryPanelProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return memories.filter((m) => {
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
      const matchesFilter = filter === 'all' || m.class === filter || m.scope === filter
      return matchesSearch && matchesFilter
    })
  }, [memories, search, filter])

  const selected = memories.find((m) => m.id === selectedMemoryId)

  return (
    <div className="memory-panel">
      <div className="memory-panel__sidebar">
        <div className="memory-panel__header">
          <div className="memory-panel__title">
            <Brain size={20} />
            <h2>Memory</h2>
          </div>
          <button
            type="button"
            className="memory-panel__add"
            onClick={onAddMemory}
            title="Add memory"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="memory-panel__search">
          <Search size={14} className="memory-panel__search-icon" />
          <input
            type="text"
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="memory-panel__filters">
          <Filter size={14} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="memory-panel__filter-select"
          >
            <option value="all">All</option>
            <option value="semantic">Semantic</option>
            <option value="episodic">Episodic</option>
            <option value="procedural">Procedural</option>
            <option value="user">User scope</option>
            <option value="project">Project scope</option>
            <option value="workspace">Workspace scope</option>
          </select>
        </div>

        <div className="memory-panel__view-toggle">
          <button
            type="button"
            className={`memory-panel__view-btn ${viewMode === 'list' ? 'memory-panel__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <FileText size={14} />
          </button>
          <button
            type="button"
            className={`memory-panel__view-btn ${viewMode === 'graph' ? 'memory-panel__view-btn--active' : ''}`}
            onClick={() => setViewMode('graph')}
            title="Graph view"
          >
            <Network size={14} />
          </button>
        </div>

        <div className="memory-panel__list">
          {filtered.length === 0 && (
            <div className="memory-panel__empty">No memories found.</div>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`memory-panel__item ${selectedMemoryId === m.id ? 'memory-panel__item--active' : ''}`}
              onClick={() => onSelectMemory?.(m)}
            >
              <div className="memory-panel__item-header">
                <span className="memory-panel__item-type">{m.class}</span>
                <span className="memory-panel__item-confidence">{Math.round(m.confidence * 100)}%</span>
              </div>
              <div className="memory-panel__item-title">{m.title}</div>
              <div className="memory-panel__item-meta">
                <Tag size={10} />
                <span>{m.tags.slice(0, 3).join(', ')}</span>
              </div>
              <div className="memory-panel__item-date">
                <Calendar size={10} />
                <span>{new Date(m.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="memory-panel__main">
        {viewMode === 'graph' ? (
          <div className="memory-panel__graph">
            <div className="memory-panel__graph-placeholder">
              <Network size={48} />
              <p>Knowledge graph visualization</p>
              <span>Nodes: {memories.length} · Edges: {Math.max(memories.length - 1, 0)}</span>
            </div>
          </div>
        ) : selected ? (
          <div className="memory-panel__detail">
            <div className="memory-panel__detail-header">
              <div>
                <h3>{selected.title}</h3>
                <div className="memory-panel__detail-meta">
                  <span className="memory-panel__detail-type">{selected.class}</span>
                  <span className="memory-panel__detail-scope">{selected.scope}</span>
                  <span className="memory-panel__detail-confidence">{Math.round(selected.confidence * 100)}% confidence</span>
                </div>
              </div>
              <button type="button" className="memory-panel__detail-more" title="More actions">
                <MoreHorizontal size={16} />
              </button>
            </div>

            <div className="memory-panel__detail-content">{selected.content}</div>

            <div className="memory-panel__detail-tags">
              {selected.tags.map((tag) => (
                <span key={tag} className="memory-panel__tag">
                  {tag}
                </span>
              ))}
            </div>

            <div className="memory-panel__detail-footer">
              <div className="memory-panel__detail-date">
                <Calendar size={14} />
                <span>Updated {new Date(selected.updatedAt).toLocaleString()}</span>
              </div>
              <div className="memory-panel__detail-source">
                <Link2 size={14} />
                <span>{selected.source?.type ?? 'unknown'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="memory-panel__placeholder">
            <Brain size={48} />
            <p>Select a memory to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
