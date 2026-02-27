import * as React from 'react'
import type { ComponentEntry } from './types'
import { DragDropManager } from '@dnd-kit/dom'
import { Sortable } from '@dnd-kit/dom/sortable'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  CloudAlert,
  CloudCheck,
  CloudOff,
  CloudUpload,
  FolderKanban,
  History,
  MoreHorizontal,
  Link2,
  ListTodo,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import { cn } from '@/lib/utils'
import './planner.css'

type TaskState = 'todo' | 'in_progress' | 'done' | 'cancelled'
type SyncState = 'local_only' | 'pending_upload' | 'uploaded' | 'remote_only' | 'unavailable' | 'upload_failed'
type PlannerEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.cancelled'
  | 'task.reopened'
  | 'task.moved'
  | 'task.session_linked'
  | 'task.session_unlinked'
  | 'task.session_snapshot_updated'

type PlannerRow =
  | { kind: 'heading'; headingId: string; key: string }
  | { kind: 'task'; taskId: string; key: string }

interface SessionSnapshot {
  id: string
  title: string
  summary: string
  lastUpdated: string
}

interface TaskSessionLinkLocal {
  id: string
  taskId: string
  snapshotId: string
  syncState: SyncState
}

interface PlannerTaskEvent {
  id: string
  taskId: string
  type: PlannerEventType
  at: string
  actor: string
  payloadSummary: string
}

interface PlannerTask {
  id: string
  headingId: string
  title: string
  notes: string
  state: TaskState
  due: string
}

interface PlannerHeading {
  id: string
  projectId: string
  title: string
  sortOrder: number
}

interface PlannerProject {
  id: string
  name: string
  status: 'open' | 'archived'
  sortOrder: number
  installationHint: string
  memberCount: number
}

const projects: PlannerProject[] = [
  { id: 'p1', name: 'Personal', status: 'open', sortOrder: 1, installationHint: 'MacBook · my-workspace', memberCount: 1 },
  { id: 'p2', name: 'Planner V2', status: 'open', sortOrder: 2, installationHint: 'MacBook · my-workspace', memberCount: 3 },
  { id: 'p3', name: 'Craft App', status: 'open', sortOrder: 3, installationHint: 'Import mounted locally', memberCount: 4 },
]

const initialHeadings: PlannerHeading[] = [
  { id: 'h1', projectId: 'p2', title: 'Today', sortOrder: 1 },
  { id: 'h2', projectId: 'p2', title: 'Upcoming', sortOrder: 2 },
  { id: 'h3', projectId: 'p2', title: 'Later', sortOrder: 3 },
]

const initialTasks: PlannerTask[] = [
  {
    id: 't1',
    headingId: 'h1',
    title: 'Build Things-like planner shell in playground',
    notes: 'Three-pane layout: projects, headings, tasks, and detail tabs. Keep rhythm calm and lightweight.',
    state: 'in_progress',
    due: 'Today · 21:00',
  },
  {
    id: 't2',
    headingId: 'h1',
    title: 'Add linked session cards with sync-state badges',
    notes: 'Snapshots should remain useful even if session cannot be resolved.',
    state: 'todo',
    due: 'Today · 22:00',
  },
  {
    id: 't3',
    headingId: 'h2',
    title: 'Task timeline tab with append-only events',
    notes: 'Map event types from task_events table to readable timeline rows.',
    state: 'todo',
    due: 'Tomorrow',
  },
  {
    id: 't4',
    headingId: 'h3',
    title: 'Project sharing UX (members + roles)',
    notes: 'Project ACL root with owner/editor/viewer hints.',
    state: 'cancelled',
    due: 'Next week',
  },
]

const snapshots: SessionSnapshot[] = [
  {
    id: 's1',
    title: 'Planner architecture review',
    summary: 'Validated portable core + local integration split; queued DB schema migration checklist.',
    lastUpdated: '5 min ago',
  },
  {
    id: 's2',
    title: 'Drag interaction tuning',
    summary: 'Following the same dnd-kit/dom path as the vertical sample for consistency.',
    lastUpdated: '1 hour ago',
  },
]

const sessionLinks: TaskSessionLinkLocal[] = [
  { id: 'l1', taskId: 't1', snapshotId: 's1', syncState: 'uploaded' },
  { id: 'l2', taskId: 't1', snapshotId: 's2', syncState: 'pending_upload' },
  { id: 'l3', taskId: 't2', snapshotId: 's1', syncState: 'unavailable' },
]

const events: PlannerTaskEvent[] = [
  { id: 'e1', taskId: 't1', type: 'task.created', at: 'Today · 18:12', actor: 'Balint', payloadSummary: 'Task created in Today heading' },
  { id: 'e2', taskId: 't1', type: 'task.session_linked', at: 'Today · 18:20', actor: 'Balint', payloadSummary: 'Linked session snapshot s1' },
  { id: 'e3', taskId: 't1', type: 'task.updated', at: 'Today · 18:27', actor: 'Balint', payloadSummary: 'Updated notes and due date' },
  { id: 'e4', taskId: 't1', type: 'task.session_snapshot_updated', at: 'Today · 18:42', actor: 'Craft Agent', payloadSummary: 'Refreshed snapshot summary' },
]

const stateStyles: Record<TaskState, string> = {
  todo: 'text-foreground/45',
  in_progress: 'text-info',
  done: 'text-success',
  cancelled: 'text-destructive/70',
}

const syncMeta: Record<SyncState, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  local_only: { label: 'Local only', icon: CloudOff, cls: 'text-foreground/55 bg-foreground/7' },
  pending_upload: { label: 'Pending upload', icon: CloudUpload, cls: 'text-info bg-info/12' },
  uploaded: { label: 'Uploaded', icon: CloudCheck, cls: 'text-success bg-success/12' },
  remote_only: { label: 'Remote only', icon: CloudCheck, cls: 'text-accent bg-accent/12' },
  unavailable: { label: 'Unavailable', icon: CloudAlert, cls: 'text-warning bg-warning/12' },
  upload_failed: { label: 'Upload failed', icon: CloudAlert, cls: 'text-destructive bg-destructive/12' },
}

interface PlannerSortableEntry {
  sortable: Sortable
  element: HTMLDivElement
  index: number
}

function buildFlatOrder(projectHeadings: PlannerHeading[], tasks: PlannerTask[]): string[] {
  const rows: string[] = []

  projectHeadings.forEach((heading) => {
    rows.push(`heading:${heading.id}`)
    tasks
      .filter(task => task.headingId === heading.id)
      .forEach(task => rows.push(`task:${task.id}`))
  })

  return rows
}

function parseHeadingIdFromKey(rowKey: string): string | null {
  return rowKey.startsWith('heading:') ? rowKey.slice('heading:'.length) : null
}

function parseTaskIdFromKey(rowKey: string): string | null {
  return rowKey.startsWith('task:') ? rowKey.slice('task:'.length) : null
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function PlannerThingsBoard() {
  const [activeProjectId, setActiveProjectId] = React.useState('p2')
  const [headingsState, setHeadingsState] = React.useState<PlannerHeading[]>(initialHeadings)
  const [tasksState, setTasksState] = React.useState<PlannerTask[]>(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = React.useState('t1')
  const [quickAdd, setQuickAdd] = React.useState('')
  const [flatOrder, setFlatOrder] = React.useState<string[]>(() => {
    const initialProjectHeadings = initialHeadings
      .filter(h => h.projectId === 'p2')
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return buildFlatOrder(initialProjectHeadings, initialTasks)
  })

  const flatListRef = React.useRef<HTMLDivElement | null>(null)
  const rowRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const managerRef = React.useRef<DragDropManager | null>(null)
  const sortableRegistryRef = React.useRef<Map<string, PlannerSortableEntry>>(new Map())
  const headingsStateRef = React.useRef(headingsState)
  const tasksStateRef = React.useRef(tasksState)
  const activeProjectIdRef = React.useRef(activeProjectId)
  const isDraggingRef = React.useRef(false)

  const project = projects.find(p => p.id === activeProjectId) ?? projects[0]
  const projectHeadings = React.useMemo(
    () => headingsState.filter(h => h.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder),
    [headingsState, project.id]
  )

  const selectedTask = tasksState.find(t => t.id === selectedTaskId)
  const selectedLinks = sessionLinks.filter(link => link.taskId === selectedTaskId)
  const selectedEvents = events.filter(e => e.taskId === selectedTaskId)

  const flatRows = React.useMemo<PlannerRow[]>(() => {
    const headingById = new Map(projectHeadings.map(heading => [heading.id, heading]))
    const taskById = new Map(tasksState.map(task => [task.id, task]))

    return flatOrder
      .map((rowKey) => {
        const headingId = parseHeadingIdFromKey(rowKey)
        if (headingId) {
          if (!headingById.has(headingId)) return null
          return { kind: 'heading', headingId, key: rowKey } as PlannerRow
        }

        const taskId = parseTaskIdFromKey(rowKey)
        if (taskId) {
          const task = taskById.get(taskId)
          if (!task) return null
          if (!headingById.has(task.headingId)) return null
          return { kind: 'task', taskId, key: rowKey } as PlannerRow
        }

        return null
      })
      .filter((row): row is PlannerRow => Boolean(row))
  }, [flatOrder, projectHeadings, tasksState])

  React.useEffect(() => {
    headingsStateRef.current = headingsState
  }, [headingsState])

  React.useEffect(() => {
    tasksStateRef.current = tasksState
  }, [tasksState])

  React.useEffect(() => {
    activeProjectIdRef.current = activeProjectId
  }, [activeProjectId])

  React.useEffect(() => {
    const canonical = buildFlatOrder(projectHeadings, tasksState)
    setFlatOrder((prev) => {
      const canonicalSet = new Set(canonical)
      const preserved = uniqueOrdered(prev.filter(key => canonicalSet.has(key)))
      const missing = canonical.filter(key => !preserved.includes(key))
      const next = uniqueOrdered([...preserved, ...missing])

      const unchanged = next.length === prev.length && next.every((key, index) => key === prev[index])
      return unchanged ? prev : next
    })
  }, [projectHeadings, tasksState])

  React.useEffect(() => {
    if (!selectedTask || !projectHeadings.some(h => h.id === selectedTask.headingId)) {
      const firstTask = tasksState.find(t => projectHeadings.some(h => h.id === t.headingId))
      setSelectedTaskId(firstTask?.id ?? '')
    }
  }, [projectHeadings, tasksState, selectedTask])

  const applyFlatOrderToState = React.useCallback((orderedKeys: string[]) => {
    const activeProject = activeProjectIdRef.current
    const headings = headingsStateRef.current
    const tasks = tasksStateRef.current
    const taskById = new Map(tasks.map(task => [task.id, task]))
    const normalizedOrderedKeys = uniqueOrdered(orderedKeys)

    const projectHeadingIds = new Set(
      headings
        .filter(heading => heading.projectId === activeProject)
        .map(heading => heading.id)
    )

    const orderedHeadingIds = uniqueOrdered(
      normalizedOrderedKeys
        .map(parseHeadingIdFromKey)
        .filter((headingId): headingId is string => Boolean(headingId && projectHeadingIds.has(headingId)))
    )

    if (orderedHeadingIds.length === 0) return

    const orderedTaskIds: string[] = []
    const seenTaskIds = new Set<string>()
    const nextHeadingByTaskId = new Map<string, string>()
    let currentHeadingId = orderedHeadingIds[0]

    normalizedOrderedKeys.forEach((rowKey) => {
      const headingId = parseHeadingIdFromKey(rowKey)
      if (headingId && projectHeadingIds.has(headingId)) {
        currentHeadingId = headingId
        return
      }

      const taskId = parseTaskIdFromKey(rowKey)
      if (!taskId) return
      if (seenTaskIds.has(taskId)) return

      const task = taskById.get(taskId)
      if (!task) return
      if (!projectHeadingIds.has(task.headingId)) return

      seenTaskIds.add(taskId)
      orderedTaskIds.push(taskId)
      nextHeadingByTaskId.set(taskId, currentHeadingId)
    })

    setHeadingsState((prev) => {
      const nextOrderByHeadingId = new Map(orderedHeadingIds.map((id, index) => [id, index + 1]))
      return prev.map((heading) => {
        if (heading.projectId !== activeProject) return heading
        const sortOrder = nextOrderByHeadingId.get(heading.id)
        return sortOrder ? { ...heading, sortOrder } : heading
      })
    })

    setTasksState((prev) => {
      const updated = prev.map((task) => {
        const nextHeadingId = nextHeadingByTaskId.get(task.id)
        if (!nextHeadingId || task.headingId === nextHeadingId) return task
        return { ...task, headingId: nextHeadingId }
      })

      const byId = new Map(updated.map(task => [task.id, task]))
      const ordered = orderedTaskIds.map(taskId => byId.get(taskId)).filter((task): task is PlannerTask => Boolean(task))
      const remaining = updated.filter(task => !orderedTaskIds.includes(task.id))
      return [...ordered, ...remaining]
    })
  }, [])

  React.useEffect(() => {
    const manager = new DragDropManager()
    const sortableRegistry = sortableRegistryRef.current
    managerRef.current = manager

    const unsubDragStart = manager.monitor.addEventListener('dragstart', () => {
      isDraggingRef.current = true
    })

    const unsubDragEnd = manager.monitor.addEventListener('dragend', (event) => {
      requestAnimationFrame(() => { isDraggingRef.current = false })
      if (event.canceled) return

      const sourceId = String(event.operation.source?.id ?? '')
      if (!sourceId.startsWith('heading:') && !sourceId.startsWith('task:')) return

      const list = flatListRef.current
      if (!list) return

      const orderedKeys = uniqueOrdered(
        Array.from(list.children)
          .map(el => (el as HTMLElement).dataset.rowKey)
          .filter((key): key is string => Boolean(key))
      )

      if (orderedKeys.length === 0) return

      setFlatOrder(orderedKeys)
      applyFlatOrderToState(orderedKeys)
    })

    return () => {
      unsubDragStart()
      unsubDragEnd()
      sortableRegistry.forEach((entry) => entry.sortable.destroy())
      sortableRegistry.clear()
      manager.destroy()
      managerRef.current = null
    }
  }, [applyFlatOrderToState])

  React.useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    const desiredEntries = new Map<string, { element: HTMLDivElement; index: number }>()

    flatRows.forEach((row, index) => {
      const element = rowRefs.current.get(row.key)
      if (!element) return

      desiredEntries.set(row.key, {
        element,
        index,
      })
    })

    desiredEntries.forEach((desired, rowKey) => {
      const existing = sortableRegistryRef.current.get(rowKey)

      if (existing) {
        if (existing.index !== desired.index) {
          existing.sortable.index = desired.index
          existing.index = desired.index
        }
        if (existing.element !== desired.element) {
          existing.sortable.element = desired.element
          existing.element = desired.element
        }
        return
      }

      const sortable = new Sortable({
        id: rowKey,
        index: desired.index,
        element: desired.element,
      }, manager)

      sortableRegistryRef.current.set(rowKey, {
        sortable,
        element: desired.element,
        index: desired.index,
      })
    })

    Array.from(sortableRegistryRef.current.keys()).forEach((rowKey) => {
      if (desiredEntries.has(rowKey)) return
      const existing = sortableRegistryRef.current.get(rowKey)
      existing?.sortable.destroy()
      sortableRegistryRef.current.delete(rowKey)
    })
  }, [flatRows])

  const addTask = React.useCallback(() => {
    const title = quickAdd.trim()
    if (!title || projectHeadings.length === 0) return

    const task: PlannerTask = {
      id: `t-${Date.now()}`,
      headingId: projectHeadings[0].id,
      title,
      notes: '',
      state: 'todo',
      due: 'Inbox',
    }

    setTasksState(prev => [task, ...prev])
    setFlatOrder((prev) => {
      const firstHeadingKey = `heading:${projectHeadings[0].id}`
      const insertionIndex = prev.indexOf(firstHeadingKey)
      if (insertionIndex === -1) return [...prev, `task:${task.id}`]
      const next = [...prev]
      next.splice(insertionIndex + 1, 0, `task:${task.id}`)
      return next
    })
    setSelectedTaskId(task.id)
    setQuickAdd('')
  }, [projectHeadings, quickAdd])

  return (
    <div className="w-[1180px] h-[760px] rounded-[16px] border border-border bg-background overflow-hidden shadow-sm">
      <div className="grid h-full grid-cols-[220px_1fr_360px]">
        <aside className="border-r border-border/60 bg-foreground/[0.015] p-3">
          <div className="mb-3 flex items-center gap-2 px-2 py-1">
            <ListTodo className="h-4 w-4 text-foreground/60" />
            <span className="text-sm font-semibold">Planner</span>
          </div>

          <div className="space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className={cn(
                  'w-full rounded-[10px] px-2.5 py-2 text-left transition-colors',
                  p.id === project.id
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-foreground/65 hover:bg-foreground/5 hover:text-foreground'
                )}
              >
                <div className="text-sm font-medium">{p.name}</div>
                <div className="mt-0.5 text-[11px] text-foreground/45">{p.installationHint}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-border/60 px-5 py-3">
            <div className="mb-2 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-foreground/50" />
              <h3 className="text-base font-semibold">{project.name}</h3>
              <Badge variant="secondary" className="text-[10px]">Portable Core</Badge>
              <Badge variant="outline" className="text-[10px]">{project.memberCount} members</Badge>
            </div>
            <div className="flex gap-2">
              <Input
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addTask()
                }}
                placeholder="Quick add task…"
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-8" onClick={addTask}>Add</Button>
            </div>
          </div>

          <ScrollArea
            className="flex-1"
            onPointerDown={(e) => {
              const target = e.target as HTMLElement
              if (target.closest('[data-row-key]')) return
              setSelectedTaskId('')
            }}
          >
            <div
              className="px-5 py-4 min-h-full flex flex-col"
            >
              <div
                ref={flatListRef}
                className="flex flex-col gap-1.5 rounded-[10px] p-1"
              >
                {flatRows.map((row, index) => {
                  if (row.kind === 'heading') {
                    const heading = projectHeadings.find(h => h.id === row.headingId)
                    if (!heading) return null

                    return (
                      <div
                        key={row.key}
                        data-row-key={row.key}
                        ref={(el) => {
                          if (el) rowRefs.current.set(row.key, el)
                          else rowRefs.current.delete(row.key)
                        }}
                        className={cn(
                          'w-full select-none',
                          index === 0 ? 'pt-1' : 'pt-3'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1.5 px-1">
                          <div className="text-[13px] font-semibold text-foreground">
                            {heading.title}
                          </div>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                data-no-dnd="true"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] hover:bg-foreground/5 data-[state=open]:bg-foreground/5"
                                aria-label={`Open ${heading.title} menu`}
                              >
                                <MoreHorizontal className="h-4 w-4 text-foreground/45" />
                              </button>
                            </DropdownMenuTrigger>
                            <StyledDropdownMenuContent align="end" minWidth="min-w-44">
                              <StyledDropdownMenuItem onClick={(e) => e.preventDefault()}>
                                <span className="flex-1">Rename section</span>
                              </StyledDropdownMenuItem>
                              <StyledDropdownMenuItem onClick={(e) => e.preventDefault()}>
                                <span className="flex-1">Add task below</span>
                              </StyledDropdownMenuItem>
                              <StyledDropdownMenuItem onClick={(e) => e.preventDefault()}>
                                <span className="flex-1">Delete section</span>
                              </StyledDropdownMenuItem>
                            </StyledDropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  }

                  const task = tasksState.find(t => t.id === row.taskId)
                  if (!task) return null

                  return (
                    <div
                      key={row.key}
                      data-row-key={row.key}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row.key, el)
                        else rowRefs.current.delete(row.key)
                      }}
                      onClick={() => { if (!isDraggingRef.current) setSelectedTaskId(task.id) }}
                      className={cn(
                        'planner-sortable-item w-full rounded-[8px] px-3 py-2 text-left select-none',
                        selectedTaskId === task.id
                          ? 'planner-sortable-item--selected bg-background'
                          : 'bg-transparent shadow-none hover:bg-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {task.state === 'done' ? (
                          <CheckCircle2 className={cn('h-4 w-4', stateStyles[task.state])} />
                        ) : (
                          <Circle className={cn('h-4 w-4', stateStyles[task.state])} />
                        )}
                        <span className={cn('min-w-0 flex-1 truncate text-sm', task.state === 'done' && 'line-through text-foreground/45')}>
                          {task.title}
                        </span>
                        <span className="text-[11px] text-foreground/45">{task.due}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex-1 min-h-12" aria-hidden="true" />
            </div>
          </ScrollArea>
        </section>

        <aside className="border-l border-border/60 bg-foreground/[0.015]">
          {!selectedTask ? (
            <div className="p-5 text-sm text-foreground/50">Select a task to inspect details.</div>
          ) : (
            <div className="h-full p-4">
              <div className="mb-3">
                <div className="text-xs text-foreground/50">Task</div>
                <div className="mt-1 text-sm font-semibold leading-snug">{selectedTask.title}</div>
              </div>

              <Tabs defaultValue="details" className="h-[calc(100%-60px)]">
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-3 h-[calc(100%-44px)]">
                  <ScrollArea className="h-full pr-1">
                    <div className="space-y-3">
                      <div className="rounded-[10px] border border-border/60 bg-background p-3">
                        <div className="mb-1 text-[11px] text-foreground/45">Notes</div>
                        <p className="text-xs leading-relaxed text-foreground/75">{selectedTask.notes}</p>
                      </div>

                      <div className="rounded-[10px] border border-border/60 bg-background p-3">
                        <div className="mb-2 text-[11px] text-foreground/45">Linked Sessions (snapshot-first)</div>
                        <div className="space-y-2">
                          {selectedLinks.map(link => {
                            const snap = snapshots.find(s => s.id === link.snapshotId)
                            if (!snap) return null
                            const meta = syncMeta[link.syncState]
                            const Icon = meta.icon
                            return (
                              <div key={link.id} className="rounded-lg border border-border/60 p-2.5 bg-foreground/[0.01]">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Link2 className="h-3.5 w-3.5 text-foreground/45" />
                                    <span className="truncate text-xs font-medium">{snap.title}</span>
                                  </div>
                                  <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]', meta.cls)}>
                                    <Icon className="h-3 w-3" />
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="text-[11px] text-foreground/60 leading-relaxed">{snap.summary}</p>
                                <div className="mt-1 text-[10px] text-foreground/45">Updated {snap.lastUpdated}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="history" className="mt-3 h-[calc(100%-44px)]">
                  <ScrollArea className="h-full pr-1">
                    <div className="space-y-2">
                      {selectedEvents.map(ev => (
                        <div key={ev.id} className="rounded-[10px] border border-border/60 bg-background p-2.5">
                          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-foreground/50">
                            <History className="h-3.5 w-3.5" />
                            <span>{ev.type}</span>
                          </div>
                          <div className="text-xs text-foreground/75">{ev.payloadSummary}</div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-foreground/45">
                            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{ev.actor}</span>
                            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{ev.at}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function PlannerSyncStatePalette() {
  return (
    <div className="w-[820px] rounded-[14px] border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="h-4 w-4 text-foreground/60" />
        Sync States (task_session_links_local)
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {(Object.keys(syncMeta) as SyncState[]).map((state) => {
          const meta = syncMeta[state]
          const Icon = meta.icon
          return (
            <div key={state} className="rounded-[10px] border border-border/60 bg-foreground/[0.015] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Icon className={cn('h-4 w-4', meta.cls.split(' ')[0])} />
                {meta.label}
              </div>
              <div className="text-xs text-foreground/60">
                Snapshot card always visible; live session resolution is optional enhancement.
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const plannerComponents: ComponentEntry[] = [
  {
    id: 'planner-things-board',
    name: 'Planner Things Board',
    category: 'Planner',
    description: 'Things 3-like planner surface with @dnd-kit/dom sortable behavior matching the vertical sample path.',
    component: PlannerThingsBoard,
    layout: 'full',
    props: [],
  },
  {
    id: 'planner-sync-palette',
    name: 'Planner Sync Palette',
    category: 'Planner',
    description: 'Visual language for task_session_links_local sync states.',
    component: PlannerSyncStatePalette,
    props: [],
  },
]
