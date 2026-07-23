import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Command,
  Search,
  Settings,
  Brain,
  FolderKanban,
  Activity,
  Clapperboard,
  Plug,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { MemoryPanel } from '../panels/memory'
import './LayoutShell.css'

export type ShellView =
  | 'command'
  | 'runs'
  | 'projects'
  | 'memory'
  | 'media-lab'
  | 'integrations'
  | 'security'
  | 'search'
  | 'settings'

export type ThemeMode = 'light' | 'dark' | 'system'

const navItems = [
  { id: 'command' as ShellView, label: 'Command', icon: Command },
  { id: 'runs' as ShellView, label: 'Runs', icon: Activity },
  { id: 'projects' as ShellView, label: 'Projects', icon: FolderKanban },
  { id: 'memory' as ShellView, label: 'Memory', icon: Brain },
  { id: 'media-lab' as ShellView, label: 'Media Lab', icon: Clapperboard },
  { id: 'integrations' as ShellView, label: 'Integrations', icon: Plug },
  { id: 'security' as ShellView, label: 'Security', icon: ShieldCheck },
  { id: 'search' as ShellView, label: 'Search', icon: Search },
  { id: 'settings' as ShellView, label: 'Settings', icon: Settings },
] as const

type LayoutShellProps = {
  initialView?: ShellView
  onNavigate?: (view: ShellView) => void
  theme?: ThemeMode
  onThemeChange?: (theme: ThemeMode) => void
  topBar?: React.ReactNode
  breadcrumbs?: { label: string; onClick?: () => void }[]
  children?: React.ReactNode
}

function LayoutShell({
  initialView = 'command',
  onNavigate,
  theme = 'system',
  onThemeChange,
  topBar,
  breadcrumbs,
  children,
}: LayoutShellProps) {
  const { t } = useTranslation()
  const [activeView, setActiveView] = useState<ShellView>(initialView)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    }
    return theme
  }, [theme])

  const handleNavigate = (view: ShellView) => {
    setActiveView(view)
    onNavigate?.(view)
  }

  return (
    <div className={`layout-shell layout-shell--${resolvedTheme}`}>
      <aside
        className={`layout-sidebar ${sidebarCollapsed ? 'layout-sidebar--collapsed' : ''}`}
        aria-label="Primary"
      >
        <div className="layout-sidebar__header">
          {!sidebarCollapsed && <span className="layout-sidebar__brand">ARCHstudio</span>}
          <button
            type="button"
            className="layout-sidebar__toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="layout-sidebar__nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`layout-nav-item ${isActive ? 'layout-nav-item--active' : ''}`}
                onClick={() => handleNavigate(item.id)}
                title={item.label}
              >
                <Icon size={18} aria-hidden="true" />
                {!sidebarCollapsed && <span className="layout-nav-item__label">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="layout-sidebar__footer">
          {!sidebarCollapsed && (
            <div className="layout-theme-toggle">
              {([
                { mode: 'light' as ThemeMode, icon: Sun, label: 'Light' },
                { mode: 'dark' as ThemeMode, icon: Moon, label: 'Dark' },
                { mode: 'system' as ThemeMode, icon: Monitor, label: 'System' },
              ]).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  className={`layout-theme-option ${theme === mode ? 'layout-theme-option--active' : ''}`}
                  onClick={() => onThemeChange?.(mode)}
                  aria-label={`${label} theme`}
                  title={label}
                >
                  <Icon size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <div className="layout-main">
        <header className="layout-topbar">
          {topBar ?? (
            <div className="layout-topbar__default">
              <div className="layout-topbar__left">
                <h1 className="layout-topbar__title">
                  {t(`shell.views.${activeView}.title`, activeView)}
                </h1>
                {breadcrumbs && breadcrumbs.length > 0 && (
                  <nav className="layout-breadcrumbs" aria-label="Breadcrumb">
                    {breadcrumbs.map((crumb, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <span className="layout-breadcrumbs__sep">/</span>}
                        {crumb.onClick ? (
                          <button
                            type="button"
                            className="layout-breadcrumbs__link"
                            onClick={crumb.onClick}
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className="layout-breadcrumbs__current">{crumb.label}</span>
                        )}
                      </React.Fragment>
                    ))}
                  </nav>
                )}
              </div>
              <div className="layout-topbar__actions" />
            </div>
          )}
        </header>

        <main className="layout-content" role="main">
          {activeView === 'memory' ? (
            <MemoryPanel />
          ) : (
            children ?? (
              <div className="layout-placeholder">
                <p>Select a view to get started.</p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  )
}

export default LayoutShell
