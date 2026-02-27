# Browser Tools

Use browser tools to control built-in **browser windows** (Chromium) inside Craft Agents.

## Browser usage paths

1. **Primary (recommended):** direct `browser_*` tools (`browser_open`, `browser_navigate`, ...). These are stateful and session-bound.
2. **Primary convenience wrapper:** `browser_tool` command tool (CLI-like string commands with strict validation).
3. **Secondary helper:** `browser-tool` CLI helper (`bun run browser-tool --help`) for operation discovery and JSON templates.

---

## Core workflow

When the browser might not be open or focused, **start with `browser_open`**:

1. `browser_open` — open/focus the in-app browser window
2. `browser_navigate` — load a URL or search query
3. `browser_snapshot` — inspect accessible elements and get refs (`@e1`, `@e2`, ...)
4. `browser_click` / `browser_fill` / `browser_select` — interact using refs
5. `browser_screenshot` — visual verification when needed

---

## `browser_tool` command wrapper

Use `browser_tool` when you want one command-style entry point:

```text
browser_tool({ command: "--help" })
browser_tool({ command: "open" })
browser_tool({ command: "navigate https://example.com" })
browser_tool({ command: "snapshot" })
browser_tool({ command: "click @e12" })
browser_tool({ command: "fill @e5 user@example.com" })
browser_tool({ command: "scroll down 800" })
browser_tool({ command: "evaluate document.title" })
```

The wrapper validates commands and returns actionable errors when arguments are missing or invalid.

---

## Tool details

### `browser_open`
Open or focus the session-bound in-app browser window.

**Use when:**
- Starting a browser workflow
- Browser may be hidden or unfocused
- You previously closed the browser window UI (close now hides by default)

**Returns:** browser instance ID

---

### `browser_navigate`
Navigate to a URL. If input is not a URL, implementations may treat it as a search query.

**Use when:**
- Loading a new page
- Redirecting to another site/workflow step

**Tip:** call `browser_open` first if visibility/focus is uncertain.

---

### `browser_snapshot`
Returns a structured accessibility tree with element refs and metadata.

**Use when:**
- Planning interactions
- Locating inputs/buttons/links reliably

**Important:** refs are not stable forever. Re-run snapshot after navigation or major DOM updates.

---

### `browser_click`
Click an element by ref from `browser_snapshot`.

**Input:** `ref` (e.g. `@e12`)

---

### `browser_fill`
Type text into an input or textarea by ref.

**Input:** `ref`, `value`

---

### `browser_select`
Select option in a `<select>` by ref + option value.

**Input:** `ref`, `value`

---

### `browser_scroll`
Scroll page in a direction.

**Input:** `direction` (`up|down|left|right`), optional `amount`

---

### `browser_back` / `browser_forward`
Navigate browser history.

---

### `browser_evaluate`
Execute JavaScript expression in page context.

**Use when:**
- Extracting complex DOM data
- Reading computed values/styles
- Triggering advanced interactions not covered by click/fill/select

---

### `browser_screenshot`
Capture screenshot of current browser window content.

**Use when:**
- Visual confirmation
- Reviewing rendering/layout issues

**Note:** prefer `browser_snapshot` for interaction targeting.

---

## End-to-end examples

### Example 1 — Open, navigate, inspect, click
```text
browser_open()
browser_navigate({ url: "https://example.com" })
browser_snapshot()
# find button ref, e.g. @e7
browser_click({ ref: "@e7" })
```

### Example 2 — Login form fill
```text
browser_open()
browser_navigate({ url: "https://app.example.com/login" })
browser_snapshot()
# fill email/password refs from snapshot
browser_fill({ ref: "@e3", value: "user@example.com" })
browser_fill({ ref: "@e5", value: "••••••••" })
browser_click({ ref: "@e6" })
```

### Example 3 — Extract custom data with evaluate
```text
browser_open()
browser_navigate({ url: "https://news.ycombinator.com" })
browser_evaluate({ expression: "Array.from(document.querySelectorAll('.titleline a')).slice(0,5).map(a => a.textContent)" })
```

### Example 4 — Recover stale refs
```text
# click fails because ref changed after navigation
browser_snapshot()   # refresh refs
browser_click({ ref: "@e11" })
```

---

## `browser-tool` helper CLI (secondary path)

Use the helper CLI to discover browser operations and get deterministic JSON templates:

```bash
bun run browser-tool --help
bun run browser-tool list
bun run browser-tool template browser_navigate
bun run browser-tool all-templates
```

The helper prints structured payload templates (`{ tool, input }`) that map to native `browser_*` tools.

## Behavior notes

- Browser tools are allowed in **Explore/Safe mode** by default.
- Before first browser tool usage, the agent must read this guide (`~/.craft-agent/docs/browser-tools.md`).
- Closing a browser window UI now **hides** it (keeps session/browser context alive).
- Use explicit destroy actions when you want full teardown/reset.

## Troubleshooting

### "Browser window controls are not available"
The desktop browser manager isn’t wired for this runtime/session. Ensure you’re using the Electron desktop app and the session is initialized.

### "Element @eX not found"
Ref is stale. Run `browser_snapshot` again and use fresh refs.

### Input interactions are flaky
Ensure page is loaded and element is visible. Retry with:
`browser_open` → `browser_snapshot` → interaction.
