# ARCH Agentz OS — "Agentz" Sidebar Feature — Build Plan

Date: 2026-07-06
Author: Claude (Fable session) for skobe
Repo: D:\dev\arch-agentzs-oss (Apache 2.0)

---

## Goal

Replace the **All Sessions** tab (and its sub-tabs: status items, Flagged, Archived) in the
left sidebar with a new **Agentz** tab. Agentz is expandable with one sub-item per agent:

- Hermes Agent  ← the only one wired up / functional for now
- Claude         (placeholder)
- OpenClaw       (placeholder)
- Odysseus       (placeholder)
- Pi             (placeholder)

---

## My honest thoughts / recommendation

A few things worth saying before you commit to this:

1. **"All Sessions" is the app's core inbox.** Removing it entirely means losing the main way
   to see your conversation history, statuses, flagged and archived chats. Before nuking it,
   consider whether you actually want it *gone* or just *collapsed / moved down*. My
   recommendation: **keep All Sessions but move it below Agentz**, OR hide it behind a setting,
   rather than deleting the code. That way you don't lose session management and the change is
   reversible. But if you're set on removing it, the plan below does exactly that.

2. **There's history here.** AppShell.tsx line ~1929 has the comment
   `// Unified sidebar items: nav buttons only (agents system removed)`. An agents system
   USED to exist in this codebase and was stripped out. Worth checking git history
   (`git log --oneline -S "agents"`) — there may be old components we can revive instead of
   building from scratch.

3. **"Only plumb up Hermes"** is the right call. Placeholders for Claude/OpenClaw/Odysseus/Pi
   can just navigate to a "coming soon" panel or be disabled (greyed out) until wired.

---

## Architecture (what I found)

The sidebar is NOT hardcoded in one place — it's two parallel structures in
`apps/electron/src/renderer/components/app-shell/AppShell.tsx`:

### A) `unifiedSidebarItems` (~line 1935)
A flat array used for **keyboard navigation only**. Each entry is `{ id, type:'nav', action }`.
Currently starts with:
```ts
result.push({ id: 'nav:allSessions', type: 'nav', action: handleAllSessionsClick })
for (const state of effectiveSessionStatuses) { ...state items... }
result.push({ id: 'nav:flagged', ... })
result.push({ id: 'nav:archived', ... })
```

### B) The visual `links={[...]}` array passed to `<LeftSidebar>` (~line 2263)
This is what actually renders. The "All Sessions" block is a single expandable `LinkItem`
with `items: [...statuses, separator, flagged, archived]`.

### C) Supporting types
- `sidebar-types.ts` — `SidebarMode` union: `sessions | sources | settings`. Navigation modes.
- `SidebarMenu.tsx` — right-click context menus per item type.
- `LeftSidebar.tsx` — pure renderer, no changes needed (already supports expandable + nested).

### D) Navigation flow
Clicking a nav item calls a handler (e.g. `handleAllSessionsClick`) which sets `navState` /
`sidebarMode`. The main content panel (`MainContentPanel.tsx` / `NavigatorPanel.tsx`) reads
that mode and renders the matching content.

---

## Build steps

### Step 1 — Add an "agent" concept to navigation types
File: `apps/electron/src/renderer/components/app-shell/sidebar-types.ts`
- Extend `SidebarMode` union with: `| { type: 'agent'; agentId: string }`
- Add `isAgentMode()` type guard.
- Add persistence key handling in `getSidebarModeKey` / `parseSidebarModeKey` (e.g. `agent:hermes`).

### Step 2 — Define the agent registry
New file: `apps/electron/src/renderer/components/app-shell/agents.ts`
```ts
export interface AgentDef {
  id: string
  title: string
  icon: LucideIcon | React.ReactNode
  enabled: boolean        // false = greyed-out placeholder
  connectionSlug?: string // for Hermes: which llmConnection drives it
}

export const AGENTZ: AgentDef[] = [
  { id: 'hermes',   title: 'Hermes Agent', icon: /*...*/, enabled: true,  connectionSlug: 'anthropic-api' },
  { id: 'claude',   title: 'Claude',       icon: /*...*/, enabled: false },
  { id: 'openclaw', title: 'OpenClaw',     icon: /*...*/, enabled: false },
  { id: 'odysseus', title: 'Odysseus',     icon: /*...*/, enabled: false },
  { id: 'pi',       title: 'Pi',           icon: /*...*/, enabled: false },
]
```
NOTE: Confirm what "Hermes Agent" should actually DO when clicked. Options:
  (a) open a new session pre-pointed at the Hermes Ollama connection/model, or
  (b) open the Hermes command-center (there's a `hermes_command_center.py` on the machine).
  Needs a decision before Step 4 handler is written.

### Step 3 — Remove (or relocate) the All Sessions block
File: `AppShell.tsx`
- In the visual `links={[...]}` array (~line 2263): remove the `nav:allSessions` LinkItem
  object (the whole expandable block incl. statuses/flagged/archived children), OR move it
  below the new Agentz block if keeping it.
- In `unifiedSidebarItems` (~line 1939): remove the matching `nav:allSessions`, `nav:state:*`,
  `nav:flagged`, `nav:archived` pushes (or relocate).
- ⚠️ Keep the handlers (`handleAllSessionsClick` etc.) defined even if unused, or remove their
  references too — dead refs will fail typecheck. Safest: comment out, don't delete, first pass.

### Step 4 — Add the Agentz block
File: `AppShell.tsx`, same `links` array, in the slot where All Sessions was.
```ts
{
  id: "nav:agentz",
  title: "Agentz",
  icon: Bot,                      // from lucide-react, already imported
  variant: isAgentMode(...) ? "default" : "ghost",
  onClick: () => handleAgentClick(AGENTZ[0].id),
  expandable: true,
  expanded: isExpanded('nav:agentz'),
  onToggle: () => toggleExpanded('nav:agentz'),
  items: AGENTZ.map(a => ({
    id: `nav:agent:${a.id}`,
    title: a.title,
    icon: a.icon,
    variant: (agentFilter?.agentId === a.id ? "default" : "ghost"),
    onClick: a.enabled ? () => handleAgentClick(a.id) : undefined,
    // greyed out when disabled — add opacity via a compact flag or custom class
  })),
}
```
Add matching entries to `unifiedSidebarItems` for keyboard nav.

### Step 5 — Wire the handler + content panel
- Add `handleAgentClick(agentId)` in AppShell.tsx → sets `sidebarMode = { type:'agent', agentId }`.
- Add agent state: `const [agentFilter, setAgentFilter] = useState<{agentId:string}|null>(null)`.
- In the content panel switch (MainContentPanel / NavigatorPanel), add a case for agent mode:
  - Hermes → render session view bound to the Hermes connection (or command center).
  - Others → render a simple "Coming soon" placeholder component.

### Step 6 — i18n strings
File: find the locale JSON (search `"sidebar.allSessions"` → same file).
- Add `"sidebar.agentz": "Agentz"` and any agent titles you want translatable.

### Step 7 — Typecheck, test, run
```bash
cd D:\dev\arch-agentzs-oss
bun install
bun run typecheck          # or: bunx tsc --noEmit
bun test                   # picker-mode etc. — make sure nothing regressed
bun run electron:start     # dev build, hot reload — verify visually
```
- If `derivePickerMode` / sidebar tests fail, update snapshots/expectations intentionally.
- The `sidebar-types` change may ripple into a couple of switch statements — follow the
  typecheck errors, they'll point you to every spot that needs an `agent` case.

### Step 8 — Build
```bash
bun run electron:build
```
Installed app: `C:\Users\skobe\AppData\Local\Programs\@arch-agentzelectron\`

---

## Files to touch (summary)

| File | Change |
|------|--------|
| `app-shell/sidebar-types.ts` | Add `agent` mode to union + type guard + persistence keys |
| `app-shell/agents.ts` (NEW) | Agent registry (Hermes enabled, rest placeholders) |
| `app-shell/AppShell.tsx` | Remove/relocate All Sessions; add Agentz block in both `links` and `unifiedSidebarItems`; add `handleAgentClick` + agent state |
| `app-shell/MainContentPanel.tsx` or `NavigatorPanel.tsx` | Render agent content (Hermes real, others placeholder) |
| locale JSON | `sidebar.agentz` + agent titles |
| `SidebarMenu.tsx` | (optional) context menu for agent items — "Add Agent" etc. |

## Files that DON'T need changes
- `LeftSidebar.tsx` — already renders expandable/nested items generically.

---

## Open questions for skobe (answer before Step 4/5)
1. Remove All Sessions entirely, or keep it but move below Agentz? (I recommend keep+move.)
2. What does clicking "Hermes Agent" do — new session on the Hermes model, or open the
   command center?
3. Should disabled agents (Claude/OpenClaw/Odysseus/Pi) be greyed-out-but-visible, or hidden
   until wired?

---

## Suggested first move
Before writing any code: run `git log --oneline --all -S "agents system"` and
`git log -S "AgentDef"` in the repo to find the removed agents system. Reviving old code beats
rebuilding. If nothing useful turns up, proceed with the plan above.


---

# ADDENDUM — Remove the middle "Navigator" panel (session list between sidebar and chat)

Added 2026-07-06 per skobe request.

## What this panel is
The middle column (title "Conversations" + session list) is the **Navigator panel**, mounted
by `PanelStackContainer.tsx`. It sits: Sidebar → **Navigator** → Chat/Content.

## Good news: it's already width-driven
In `PanelStackContainer.tsx`, the navigator slot uses `hasNavigator = navigatorWidth > 0` and
animates fully away (`width: 0, opacity: 0, marginRight: -PANEL_GAP`) when width is 0. So we
DON'T delete any component — we just drive its width to 0. Clean, reversible, animated.

## The single control point
File: `AppShell.tsx` line ~3265:
```tsx
navigatorWidth={isAutoCompact ? sessionListWidth : (effectiveSidebarAndNavigatorHidden ? 0 : sessionListWidth)}
```

## Options

### Option 1 — Hide navigator ONLY in Agentz mode (recommended)
Keeps the session list for normal chat use, hides it when you're in the Agentz view.
```tsx
navigatorWidth={
  isAutoCompact
    ? sessionListWidth
    : (effectiveSidebarAndNavigatorHidden || isAgentMode(sidebarMode)) ? 0 : sessionListWidth
}
```
(Requires the `isAgentMode` guard from Step 1 of the main plan.)

### Option 2 — Remove the navigator entirely, everywhere
Simplest structurally, but you lose the session list in ALL views (including normal chats).
Only do this if you truly never want the middle column.
```tsx
navigatorWidth={0}
```
Then also: remove the sash/resize handle logic tied to `sessionListWidth`, and the navigator
`headerActions` become dead code (harmless, but clean them up to satisfy typecheck/lint).

### Option 3 — Keep it available but collapsed by default
Set the default `sessionListWidth` to 0 and add a toggle (e.g. in TopBar) to bring it back.
Most flexible; a bit more work (persist the toggle in localStorage).

## Recommendation
**Option 1.** It pairs naturally with the Agentz feature: Agentz view = no middle panel
(agent runs full-width next to sidebar), normal chats keep their session list. If you later
decide you never want the list, flip to Option 2 — it's a one-line change.

## Files to touch
| File | Change |
|------|--------|
| `AppShell.tsx` (~line 3265) | Add `isAgentMode(...)` (Opt 1) or hardcode `0` (Opt 2) to the `navigatorWidth` prop |
| `AppShell.tsx` | (Opt 2 only) remove/guard the navigator resize sash + `sessionListWidth` usage |

No changes needed to `PanelStackContainer.tsx` or `NavigatorPanel.tsx` — they already handle
width 0 gracefully.

## One thing to watch
When navigator width goes to 0 AND sidebar is present, the chat panel's left edge radius is
handled by `isLeftEdge = !hasSidebar && !hasNavigator`. With sidebar still shown, the chat
panel is NOT at the left edge, so corner radii stay correct. Verified in PanelStackContainer
logic — no visual glitch expected. Just eyeball it in the dev build to be sure.

## Decision needed from skobe
Which option — 1 (hide only in Agentz), 2 (remove everywhere), or 3 (collapsible)?
The main plan's open-questions list now has this as Q4.
