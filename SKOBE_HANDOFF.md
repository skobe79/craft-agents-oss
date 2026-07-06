# ARCH Agentz OS — Model Picker Feature Handoff

## Context
User: skobe (skobeponga@gmail.com)
Date: 2026-07-06
Goal: Make the local model list less overwhelming by adding per-provider sub-pages/filtering to the model picker.

---

## What's been done

### 1. ARCH Agentz OS config fixes (already applied to live install)
- `C:\Users\skobe\.arch-agentz\config.json`
- Ollama baseUrl fixed: `http://localhost:11434` → `http://localhost:11434/v1` (was 404ing)
- HuggingFace endpoint updated to `https://router.huggingface.co/v1`
- GitHub Models endpoint updated to `https://models.github.ai/inference`
- Ollama model list deduped: 111 → 61 entries (plain versions dropped, -64k kept)
- Default model repointed: `qwen3.6:27b` → `richardyoung/qwen2.5-coder-14b-instruct-abliterated:Q4_K_M-64k`
- Telegram owner ID set to `7157540441` in messaging config

### 2. Source repo cloned
- Repo: `github.com/lukilabs/arch-agentzs-oss` (Apache 2.0)
- Cloned to: `D:\dev\arch-agentzs-oss`
- Version: 0.10.5

### 3. Root cause of the wide model list identified
File: `D:\dev\arch-agentzs-oss\apps\electron\src\renderer\components\app-shell\input\picker-mode.ts`

The picker has 4 modes: `unavailable`, `switcher`, `locked-single`, `flat`

- `switcher` mode = grouped by provider with expandable accordion — ONLY fires on empty (new) sessions
- `flat` mode = all models from active connection dumped in one long list — fires mid-conversation

The user hits `flat` mode every time because they're already in a conversation.

### 4. The UI component
File: `D:\dev\arch-agentzs-oss\apps\electron\src\renderer\components\app-shell\input\CompactModelSelector.tsx`
521 lines, React + Tailwind + Radix Drawer, well-structured.

---

## What needs to be built

### Feature: Search/filter + provider sub-pages in model picker

**Two scenarios to fix:**

#### A) Flat mode (mid-conversation, single connection active)
The 61-model Ollama list renders as a flat scroll. Fix: add a search input at the top of the drawer that filters models by name as you type. Simple, low-risk, doesn't touch any mode logic.

#### B) Switcher mode (new session, multiple connections)
Already has an accordion but it's cramped. Enhancement: clicking a provider row navigates to a full sub-view (back button + that provider's models only + search). Optional — the accordion already works reasonably, but a dedicated sub-page would be cleaner.

### Implementation plan

**Step 1 — Add search to flat mode** (easiest, highest impact for user right now)

In `CompactModelSelector.tsx`, in the `flat` branch (around line 370), add:
```tsx
const [search, setSearch] = React.useState('')
// Reset search on close
React.useEffect(() => { if (!open) setSearch('') }, [open])

// Filter availableModels:
const filteredModels = availableModels.filter(m => {
  const id = typeof m === 'string' ? m : m.id
  return id.toLowerCase().includes(search.toLowerCase())
})
```

Add a search input at the top of the flat model list section:
```tsx
<input
  type="text"
  placeholder="Search models..."
  value={search}
  onChange={e => setSearch(e.target.value)}
  className="w-full px-3 py-2 text-sm bg-foreground/5 rounded-lg outline-none mb-1"
  autoFocus
/>
```

Then render `filteredModels` instead of `availableModels` in the flat branch.

**Step 2 — Provider sub-page in switcher mode** (optional polish)

Add a second state: `subViewConnection: string | null`. When a provider row is clicked, set this instead of expanding inline. Render a separate view inside the Drawer with a back button and that connection's model list + search. This replaces the inline accordion expand for a cleaner feel.

---

## Build & test commands
```bash
cd D:\dev\arch-agentzs-oss
bun install
bun run electron:start   # dev build with hot reload
```

The installed app lives at:
`C:\Users\skobe\AppData\Local\Programs\@arch-agentzelectron\`

Once happy with changes, build with:
```bash
bun run electron:build
```

---

## Files to touch
| File | Change |
|------|--------|
| `apps/electron/src/renderer/components/app-shell/input/CompactModelSelector.tsx` | Add search state + filter logic + search input UI in flat branch. Optionally add sub-view navigation for switcher branch. |
| `apps/electron/src/renderer/components/app-shell/input/picker-mode.ts` | No changes needed — mode logic is fine. |

---

## Backups
All config changes have backups at:
- `C:\Users\skobe\.arch-agentz\config.json.bak-claude-2026-07-06`
- `C:\Users\skobe\.arch-agentz\config.json.bak-claude-dedupe-2026-07-06`
- `C:\Users\skobe\.arch-agentz\config.json.bak-claude-64k-2026-07-06`

---

## Notes for the agent
- User prefers casual tone
- User is on Windows 11, PowerShell default shell
- Ollama is running at localhost:11434 with ~61 models
- The -64k model variants are intentional (expanded context window versions)
- Do NOT touch `picker-mode.ts` logic — the mid-session connection lock is intentional
- The repo is Apache 2.0 — free to modify
