import React, { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Brain, Coffee, Globe, Server, ShieldAlert, Check } from 'lucide-react'
import { THINKING_LEVEL_IDS, type ThinkingLevel } from '@craft-agent/shared/agent/thinking-levels'
import type { NetworkProxySettings } from '@craft-agent/shared/config'
import type { ServerStatus } from '@craft-agent/shared/config/server-config'
import './SettingsPanel.css'

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
}

type SaveState = 'idle' | 'saving' | 'saved'

export function SettingsPanel() {
  const [thinking, setThinking] = useState<ThinkingLevel | null>(null)
  const [keepAwake, setKeepAwake] = useState<boolean | null>(null)
  const [proxy, setProxy] = useState<NetworkProxySettings | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null)
  const [saved, setSaved] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Initial load — each setting has its own handler, so failures are isolated.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [level, awake, proxyCfg, status] = await Promise.all([
          window.electronAPI.getDefaultThinkingLevel(),
          window.electronAPI.getKeepAwakeWhileRunning(),
          window.electronAPI.getNetworkProxySettings(),
          window.electronAPI.getServerStatus(),
        ])
        if (cancelled) return
        setThinking(level)
        setKeepAwake(awake)
        setProxy(proxyCfg ?? { enabled: false })
        setServerStatus(status)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const flashSaved = () => {
    setSaved('saved')
    setTimeout(() => setSaved('idle'), 1600)
  }

  const changeThinking = async (level: ThinkingLevel) => {
    const previous = thinking
    setThinking(level)
    setSaved('saving')
    try {
      await window.electronAPI.setDefaultThinkingLevel(level)
      flashSaved()
    } catch (err) {
      setThinking(previous)
      setSaved('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const changeKeepAwake = async (value: boolean) => {
    const previous = keepAwake
    setKeepAwake(value)
    setSaved('saving')
    try {
      await window.electronAPI.setKeepAwakeWhileRunning(value)
      flashSaved()
    } catch (err) {
      setKeepAwake(previous)
      setSaved('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const commitProxy = async (next: NetworkProxySettings) => {
    setProxy(next)
    setSaved('saving')
    try {
      await window.electronAPI.setNetworkProxySettings(next)
      flashSaved()
    } catch (err) {
      setSaved('idle')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <div className="settings-panel__title">
          <SettingsIcon size={20} />
          <h2>Settings</h2>
        </div>
        {saved !== 'idle' && (
          <span className={`settings-panel__saved${saved === 'saved' ? ' is-done' : ''}`}>
            {saved === 'saving' ? 'Saving…' : (
              <>
                <Check size={13} /> Saved
              </>
            )}
          </span>
        )}
      </div>

      <div className="settings-panel__body">
        {error && <div className="settings-error">{error}</div>}

        <section className="settings-section">
          <div className="settings-section__head">
            <Brain size={16} />
            <h3>Reasoning</h3>
          </div>
          <p className="settings-section__lead">
            Default thinking level for new sessions. Higher levels reason longer and cost more tokens.
          </p>
          <div className="settings-levels">
            {THINKING_LEVEL_IDS.map((level) => (
              <button
                key={level}
                type="button"
                className={`settings-level${thinking === level ? ' is-active' : ''}`}
                disabled={thinking === null}
                onClick={() => void changeThinking(level)}
              >
                {THINKING_LABELS[level]}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <Coffee size={16} />
            <h3>Power</h3>
          </div>
          <label className="settings-row">
            <div>
              <span className="settings-row__label">Keep awake while running</span>
              <span className="settings-row__hint">
                Prevents sleep while an agent session is active.
              </span>
            </div>
            <input
              type="checkbox"
              className="settings-switch"
              checked={keepAwake ?? false}
              disabled={keepAwake === null}
              onChange={(e) => void changeKeepAwake(e.target.checked)}
            />
          </label>
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <Globe size={16} />
            <h3>Network proxy</h3>
          </div>
          <label className="settings-row">
            <div>
              <span className="settings-row__label">Route traffic through a proxy</span>
              <span className="settings-row__hint">Applies to model and integration requests.</span>
            </div>
            <input
              type="checkbox"
              className="settings-switch"
              checked={proxy?.enabled ?? false}
              disabled={proxy === null}
              onChange={(e) => void commitProxy({ ...(proxy ?? {}), enabled: e.target.checked })}
            />
          </label>

          {proxy?.enabled && (
            <div className="settings-fields">
              <label className="settings-field">
                <span>HTTP proxy</span>
                <input
                  type="text"
                  placeholder="http://proxy.local:8080"
                  value={proxy.httpProxy ?? ''}
                  onChange={(e) => setProxy({ ...proxy, httpProxy: e.target.value })}
                  onBlur={() => void commitProxy(proxy)}
                />
              </label>
              <label className="settings-field">
                <span>HTTPS proxy</span>
                <input
                  type="text"
                  placeholder="http://proxy.local:8080"
                  value={proxy.httpsProxy ?? ''}
                  onChange={(e) => setProxy({ ...proxy, httpsProxy: e.target.value })}
                  onBlur={() => void commitProxy(proxy)}
                />
              </label>
              <label className="settings-field">
                <span>No proxy for</span>
                <input
                  type="text"
                  placeholder="localhost, 127.0.0.1, .internal"
                  value={proxy.noProxy ?? ''}
                  onChange={(e) => setProxy({ ...proxy, noProxy: e.target.value })}
                  onBlur={() => void commitProxy(proxy)}
                />
              </label>
            </div>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section__head">
            <Server size={16} />
            <h3>Remote server</h3>
          </div>
          {serverStatus === null ? (
            <p className="settings-section__lead">Loading server status…</p>
          ) : (
            <>
              <div className="settings-status">
                <span className={`settings-dot${serverStatus.running ? ' is-on' : ''}`} />
                <span>{serverStatus.running ? 'Running' : 'Stopped'}</span>
                {serverStatus.running && <code>{serverStatus.url}</code>}
                {serverStatus.tls && <span className="settings-tag">TLS</span>}
              </div>
              {serverStatus.insecureWarning && (
                <div className="settings-warn">
                  <ShieldAlert size={14} />
                  Bound to a network address without TLS — traffic is unencrypted.
                </div>
              )}
              {serverStatus.needsRestart && (
                <div className="settings-warn">
                  <ShieldAlert size={14} />
                  Saved config differs from the running server. Restart to apply.
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
