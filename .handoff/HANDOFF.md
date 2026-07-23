# ARCHstudio Agents — Handoff
> Current state as of the latest commit on `redesign/owner-agent`.

## Done
- Added MemoryPanel UI with list/graph views, search, filters, and detail pane.
- Added MemoryGraph SVG visualization for the 2nd-brain graph view.
- Added CommandPanel scaffold with terminal-like history/run UI.
- Added HomeHero matching the ARCHstudio brand direction.
- Wired `LayoutShell` view routing for `memory`, `runs`, and command/home.
- Committed UI pieces to git.

## Brand direction
- Dark surface with high contrast.
- Lime-to-electric-purple accent gradient.
- Minimal typographic logo emphasis.

## Code map
- `apps/electron/src/renderer/shell/LayoutShell.tsx` — main shell and view routing.
- `apps/electron/src/renderer/panels/memory/MemoryPanel.tsx` — memory list/detail/graph UI.
- `apps/electron/src/renderer/panels/memory/MemoryGraph.tsx` — SVG graph.
- `apps/electron/src/renderer/panels/command/CommandPanel.tsx` — command scaffold.
- `apps/electron/src/renderer/home/HomeHero.tsx` — branded hero.
- `packages/shared/src/memory/types.ts` — shared memory types.

## Todo
- Complete remaining 7 panels and route them in `LayoutShell`.
- Connect MemoryPanel and CommandPanel to real backends.
- Implement real graph data model with edges/weights.
- Add project/media/workflow panels with data sources.
- Polish auth, permissions, and project scoping UI.
- Add desktop shortcuts and first-run setup.

## Session 2026-07-24
- RunsPanel now live: reads `sessionMetaMapAtom` (jotai) — real session runs with status (running/failed/completed/idle), duration, message count, token usage/cost. Sorted running-first. Live-count pill + empty state + spinner CSS.
- Fixed LayoutShell import (`../panels/runs`), `runs` view routed.
- Fixed pre-existing typecheck errors: MemoryPanel imports `@craft-agent/shared/memory/types`, mocks cast via unknown, source display uses sessionId, exported MemoryPanelProps/CommandPanelProps. `bun run typecheck` clean.

## Next step
- Connect CommandPanel to a real command backend, then continue panel coverage (7 remaining panels in LayoutShell).
