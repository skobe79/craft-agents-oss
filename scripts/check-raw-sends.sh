#!/bin/bash
# Lint guard: detect raw webContents.send() outside typed wrappers.
#
# Approved locations:
#   - window-manager.ts:  broadcastToAll / broadcastToWorkspace / sendToWindow (typed wrappers)
#   - browser-pane-manager.ts:  toolbar scope (separate preload context, not in BroadcastEventMap)
#   - menu.ts:  sendToRenderer (typed with MenuBroadcastChannel)
#   - ipc/workspace.ts:  theme broadcasts that exclude the sender (no broadcastToAllExcept helper)
#
# All other raw webContents.send() calls should use the typed WindowManager methods.

VIOLATIONS=$(rg 'webContents\.send\(' apps/electron/src/main/ \
  --glob '!**/window-manager.ts' \
  --glob '!**/browser-pane-manager.ts' \
  --glob '!**/menu.ts' \
  --glob '!**/ipc/workspace.ts' \
  -l 2>/dev/null)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: Raw webContents.send() found outside approved wrappers:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use windowManager.broadcastToAll/broadcastToWorkspace/sendToWindow instead."
  echo "See apps/electron/src/main/window-manager.ts for typed broadcast methods."
  exit 1
fi

echo "OK: No raw webContents.send() outside approved wrappers."
