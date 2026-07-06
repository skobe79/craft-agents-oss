# SKOBE HANDOFF — ARCH Agentz OS session
_Written 2026-07-06 ~20:15 UTC. Pick up here after the daily-limit break._

## TL;DR of where we are
Everything is working. ARCH Agentz OS **dev build** is running, Agentz panel restored, all
providers wired. Only loose end: 2 local git commits not yet pushed to GitHub (needs `gh auth login`).

---

## What got done this session

### 1. config.json cleanup (`C:\Users\skobe\.arch-agentz\config.json`)
- Removed 3 dead WORMGPT model entries.
- Fixed 3 stale `-64k` refs, reran `make64k.ps1` — all 64k variants now exist, refs point at them.
- JSON validates. Backup: `config.json.bak-claude-cleanup-2026-07-06`.

### 2. New providers added to config
- **LM Studio** (`http://localhost:1234/v1`) — model set to actual loaded `google/gemma-4-12b-qat`.
  Note: LM Studio only serves *loaded* models; update the id if user loads a different one
  (or tell them to enable JIT model loading in LM Studio server settings).
- **Ollama Cloud** (`https://ollama.com/v1`, slug `ollama-cloud`) — NEW standalone provider,
  `api_key` auth. USER STILL NEEDS TO PASTE KEY in Craft UI (regenerate at ollama.com/settings —
  same key Hermes needs at .env line 477).
- **llama.cpp** (`http://localhost:8080/v1`) — see below, now actually installed + working.

### 3. llama.cpp installed
- Binaries: `D:\llama.cpp` (build b9878, CUDA 13.3, for RTX 5070 Ti 16GB).
- Launcher: `D:\llama.cpp\start-llama.ps1` — resolves an Ollama model's GGUF blob and serves on :8080
  as alias `local-model`. Default model = `llama3.1:8b`. Usage: `.\start-llama.ps1 -Model "gemma4:12b"`.
- GOTCHA: qwen3.5/3.6 GGUFs use Ollama-patched metadata (`rope.dimension_sections` len mismatch)
  that vanilla llama.cpp rejects. Keep qwen family on Ollama; llama.cpp is fine for llama/gemma/etc.
- VRAM: llama.cpp + Ollama share 16GB. Kill the llama-server window when idle.

### 4. THE BIG ONE — "agents vanished" mystery, SOLVED
- The Agentz panel (Hermes/Claude/OpenClaw/Odysseus/Pi) is **hardcoded** in the dev branch at
  `D:\dev\arch-agentzs-oss\apps\electron\src\renderer\components\app-shell\agents.ts`.
  Only Hermes is `enabled:true`; the other 4 are `enabled:false` "coming soon" placeholders.
- It is NOT a feature of the installed 0.10.5 release. Nothing was ever deleted.
- Root cause of "vanish": user had been running the DEV build (agents visible), then launched the
  INSTALLED app (`C:\Users\skobe\AppData\Local\Programs\@arch-agentzelectron`, v0.10.5, no Agentz).
- Fixed a real Windows bug in `scripts/electron-dev.ts`: it resolved electron via the
  `node_modules/.bin/electron` shim, which on Windows produced a broken `dist\dist\electron.exe\n`
  path (trailing newline + doubled dir) -> ENOENT. Changed ELECTRON_BIN to point straight at
  `node_modules/electron/dist/electron.exe` on Windows.

---

## Current running state
- ARCH Agentz OS DEV build is RUNNING (launched via `bun run electron:dev` from `D:\dev\arch-agentzs-oss`,
  logs at `%TEMP%\craft-dev.log` / `.err.log`). Electron up, scheduler ticking, no errors.
- To relaunch if needed: `%TEMP%\relaunch.ps1` (kills old, restarts dev build).
- Installed 0.10.5 app is CLOSED (don't run both — they share config).

## Git state (`D:\dev\arch-agentzs-oss`)
- Branch `main`, **2 commits ahead of origin**, working tree clean:
  - `d76daadf` fix: resolve electron binary directly on Windows dev script
  - `c3ce6bec` feat: model picker search + Agentz sidebar
- `origin` = https://github.com/lukilabs/arch-agentzs-oss.git (UPSTREAM — no push access).

---

## OUTSTANDING / next steps
1. **Push commits to GitHub backup** — BLOCKED on `gh auth login` (user not logged in).
   After login: `gh repo fork lukilabs/arch-agentzs-oss --remote` then `git push fork main`.
2. **Paste Ollama Cloud API key** into Craft UI (regenerate first at ollama.com/settings).
3. Optional: commit is done, but nothing pushed anywhere off-machine yet.

## Environment notes
- User: Skobez / skobeponga@gmail.com. Windows 11, RTX 5070 Ti 16GB, GPU good.
- Ollama at `D:\Ollama\Models`, 102 models, daemon up on :11434. bun 1.3.13, node 26.4.0.
- Telegram bot @SKobez5179_bot, owner 7157540441 — gateway healthy, no errors.
- Tooling used: Desktop Commander (start_process + script files; inline `$_`/parens in -Command
  break PowerShell parsing, so WRITE .ps1 FILES and run with -File).

---
## SESSION 3 UPDATE (2026-07-06 ~20:25 UTC) — AgentRing feature added

### What was built: spinning blue "busy ring" (like Claude's chat indicator)
User wanted a small blue circular ring that spins + glows when busy. Built it:

- **NEW component:** `apps/electron/src/renderer/components/app-shell/AgentRing.tsx`
  `<AgentRing active={bool} size={18} />` — spins+glows when active, breathes when idle,
  respects prefers-reduced-motion.
- **CSS appended** to `apps/electron/src/renderer/index.css` (bottom, ~77 lines): conic-gradient
  shine + glow + keyframes, uses color-mix so it adapts light/dark. Class names: `.agent-ring`,
  `.agent-ring--busy`, `.agent-ring--idle`.
- **Wired into** `MainContentPanel.tsx` — the Hermes agent DETAIL panel header (the panel that
  opens when you click Hermes in Agentz). Added `import { AgentRing } from './AgentRing'` and
  wrapped `agent.icon` with the ring. Currently `active={agent.enabled}` (so Hermes spins as a
  live indicator). TODO for later: swap that to the real `isProcessing` session signal.
- Typecheck PASSED (bun run typecheck in apps/electron = exit 0). No errors.

### NOT YET DONE
- User hadn't confirmed seeing the ring yet (window kept dropping during edits).
- Optional idea floated: also add a smaller 14px ring in the SIDEBAR row next to Hermes
  (in AppShell.tsx around line ~2293, the AGENTZ.map items). Not done.
- These AgentRing changes are UNCOMMITTED. Should become their own commit on top of Agentz work.

### IMPORTANT OPERATIONAL NOTE — "Agentz keeps vanishing"
Root cause each time: the DEV Electron WINDOW dies (during file edits / relaunch races), leaving
the bun dev-server running. When user reopens they may hit the installed 0.10.5 app (no Agentz) OR
just see the dead dev window. THE DEV WINDOW PROCESS IS NAMED `electron`, NOT `ARCH Agentz OS`
(that name is only the packaged/installed build). So check `Get-Process electron`, not 'ARCH Agentz OS'.

### CLEAN RESTART PROCEDURE (use this, the old relaunch.ps1 was unreliable):
`%TEMP%\fullrestart.ps1` — kills electron + bun, waits, restarts `bun run electron:dev`.
Then wait ~60s and confirm `Get-Process electron` is up. Logs: %TEMP%\craft-dev.log / .err.log.
As of this writing: dev build IS running, electron up, no errors.

### Still outstanding from before (unchanged):
- `gh auth login` -> then fork + push commits (d76daadf, c3ce6bec) to user's GitHub.
- Paste Ollama Cloud API key in Craft UI.
- The AgentRing work needs committing once user confirms it looks good.
