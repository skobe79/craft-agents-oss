import React, { useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { Plug, Search, CheckCircle2, KeyRound, XCircle, CircleDashed, PowerOff } from 'lucide-react'
import type { SourceConnectionStatus } from '@craft-agent/shared/sources/types'
import { sourcesAtom } from '../../atoms/sources'
import './IntegrationsPanel.css'

export type IntegrationsPanelProps = {
  onSelectSource?: (sourceId: string) => void
  selectedSourceId?: string
}

const STATUS_META: Record<
  SourceConnectionStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  connected: { label: 'Connected', icon: CheckCircle2, className: 'is-connected' },
  needs_auth: { label: 'Needs auth', icon: KeyRound, className: 'is-needs-auth' },
  failed: { label: 'Failed', icon: XCircle, className: 'is-failed' },
  untested: { label: 'Untested', icon: CircleDashed, className: 'is-untested' },
  local_disabled: { label: 'Disabled', icon: PowerOff, className: 'is-disabled' },
}

const STATUS_ORDER: SourceConnectionStatus[] = [
  'failed',
  'needs_auth',
  'connected',
  'untested',
  'local_disabled',
]

export function IntegrationsPanel({ onSelectSource, selectedSourceId }: IntegrationsPanelProps) {
  const sources = useAtomValue(sourcesAtom)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SourceConnectionStatus | 'all'>('all')

  const userSources = useMemo(() => sources.filter((s) => !s.isBuiltin), [sources])

  const counts = useMemo(() => {
    const map = new Map<SourceConnectionStatus, number>()
    for (const s of userSources) {
      const status = s.config.connectionStatus ?? 'untested'
      map.set(status, (map.get(status) ?? 0) + 1)
    }
    return map
  }, [userSources])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return userSources
      .filter((s) => {
        const status = s.config.connectionStatus ?? 'untested'
        return statusFilter === 'all' || status === statusFilter
      })
      .filter(
        (s) =>
          !q ||
          s.config.name.toLowerCase().includes(q) ||
          s.config.provider.toLowerCase().includes(q) ||
          (s.config.tagline ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const sa = STATUS_ORDER.indexOf(a.config.connectionStatus ?? 'untested')
        const sb = STATUS_ORDER.indexOf(b.config.connectionStatus ?? 'untested')
        if (sa !== sb) return sa - sb
        return a.config.name.localeCompare(b.config.name)
      })
  }, [userSources, search, statusFilter])

  return (
    <div className="integrations-panel">
      <div className="integrations-panel__header">
        <div className="integrations-panel__title">
          <Plug size={20} />
          <h2>Integrations</h2>
          <span className="integrations-panel__count">{visible.length}</span>
        </div>
        <div className="integrations-panel__search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="integrations-panel__filters">
        <button
          type="button"
          className={`integrations-chip${statusFilter === 'all' ? ' is-active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All <span>{userSources.length}</span>
        </button>
        {STATUS_ORDER.filter((s) => counts.get(s)).map((status) => {
          const meta = STATUS_META[status]
          const Icon = meta.icon
          return (
            <button
              key={status}
              type="button"
              className={`integrations-chip ${meta.className}${statusFilter === status ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              <Icon size={13} />
              {meta.label} <span>{counts.get(status)}</span>
            </button>
          )
        })}
      </div>

      <div className="integrations-panel__grid">
        {visible.length === 0 && (
          <div className="integrations-panel__empty">
            <Plug size={48} />
            <p>{userSources.length === 0 ? 'No integrations configured' : 'Nothing matches this filter'}</p>
          </div>
        )}
        {visible.map((source) => {
          const cfg = source.config
          const status = cfg.connectionStatus ?? 'untested'
          const meta = STATUS_META[status]
          const Icon = meta.icon
          const isSelected = cfg.id === selectedSourceId
          return (
            <button
              key={cfg.id}
              type="button"
              className={`integrations-card${isSelected ? ' is-selected' : ''}${cfg.enabled ? '' : ' is-off'}`}
              onClick={() => onSelectSource?.(cfg.id)}
            >
              <div className="integrations-card__top">
                <span className="integrations-card__icon">
                  {cfg.icon && !cfg.icon.startsWith('http') ? cfg.icon : cfg.name.charAt(0).toUpperCase()}
                </span>
                <div className="integrations-card__id">
                  <h3>{cfg.name}</h3>
                  <span className="integrations-card__provider">
                    {cfg.provider} · {cfg.type}
                  </span>
                </div>
              </div>
              {cfg.tagline && <p className="integrations-card__tagline">{cfg.tagline}</p>}
              <div className="integrations-card__footer">
                <span className={`integrations-status ${meta.className}`}>
                  <Icon size={13} />
                  {meta.label}
                </span>
                {!cfg.enabled && <span className="integrations-card__off">Disabled</span>}
              </div>
              {status === 'failed' && cfg.connectionError && (
                <p className="integrations-card__error" title={cfg.connectionError}>
                  {cfg.connectionError}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
