#!/bin/bash

# Self-update script for Craft Agent Electron app
# This script is spawned by the app before quitting to install updates
#
# Usage: self-update.sh <dmg_path> <app_path>
# Environment variables:
#   CRAFT_UPDATE_DMG - Path to the downloaded DMG file
#   CRAFT_APP_PATH   - Path to the currently running app executable

set -e

APP_NAME="Craft Agent.app"
INSTALL_DIR="/Applications"
APP_BUNDLE_ID="com.lukilabs.craft-agent"

# Get DMG path from argument or environment
DMG_PATH="${1:-$CRAFT_UPDATE_DMG}"
APP_PATH="${2:-$CRAFT_APP_PATH}"

# Logging to temp file for debugging
LOG_FILE="/tmp/craft-agent-update.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    # Close progress dialog if running
    cleanup_dialog 2>/dev/null || true
    # Show notification on failure
    osascript -e 'display notification "Update failed. Please try again." with title "Craft Agent"' 2>/dev/null || true
    exit 1
}

# Placeholder for cleanup_dialog - defined after DIALOG_PID is set
cleanup_dialog() { :; }

log "Starting self-update"
log "DMG path: $DMG_PATH"
log "App path: $APP_PATH"

# Show progress UI (macOS only - osascript is not available on other platforms)
DIALOG_PID=""
if [ "$(uname)" = "Darwin" ]; then
    # Show notification immediately so user knows update is in progress
    osascript -e 'display notification "Installing update, please wait..." with title "Craft Agent"' 2>/dev/null || true

    # Show a non-blocking dialog with app icon that persists during the update
    # Use exec to ensure the PID we capture is for osascript itself, not a subshell
    bash -c 'exec osascript -e "tell application \"System Events\" to display dialog \"Updating Craft Agent…

Please wait until the new version starts.\" with title \"Craft Agent\" buttons {} giving up after 30 with icon file \"Applications:Craft Agent.app:Contents:Resources:icon.icns\""' 2>/dev/null &
    DIALOG_PID=$!
    log "Started progress dialog (PID: $DIALOG_PID)"
fi

# Function to cleanup dialog on exit (success or failure)
# TODO: The dialog is owned by System Events, not osascript, so killing the process doesn't close it.
#       The dialog auto-dismisses after 30 seconds via "giving up after 30".
#       To properly close it, we'd need either:
#       1. Accessibility permissions to send Escape keystroke
#       2. A native Swift helper app that can be controlled programmatically
#       3. Replace with notification-only approach (no dialog)
cleanup_dialog() {
    # Try to kill the osascript process if still running
    if [ -n "$DIALOG_PID" ]; then
        kill -9 $DIALOG_PID 2>/dev/null || true
    fi
    log "Closed progress dialog"
}

# Validate DMG path
if [ -z "$DMG_PATH" ] || [ ! -f "$DMG_PATH" ]; then
    error "DMG file not found: $DMG_PATH"
fi

# Wait for app to quit completely (max 30 seconds)
log "Waiting for app to quit..."
for i in $(seq 1 60); do
    if ! pgrep -x "Craft Agent" >/dev/null 2>&1; then
        log "App has quit after $i half-seconds"
        break
    fi
    sleep 0.5
done

# Force kill if still running
if pgrep -x "Craft Agent" >/dev/null 2>&1; then
    log "Force killing app..."
    pkill -9 -x "Craft Agent" 2>/dev/null || true
    sleep 2
fi

# Extra wait for file handles to be released
sleep 1

# Remove existing installation if present
if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
    log "Removing previous installation..."
    rm -rf "$INSTALL_DIR/$APP_NAME" || error "Failed to remove old app"
fi

# Mount DMG
log "Mounting DMG..."
mount_point=$(hdiutil attach "$DMG_PATH" -nobrowse -mountrandom /tmp 2>/dev/null | tail -1 | awk '{print $NF}')

if [ -z "$mount_point" ] || [ ! -d "$mount_point" ]; then
    error "Failed to mount DMG"
fi

log "Mounted at: $mount_point"

# Find the .app in the mounted volume
app_source=$(find "$mount_point" -maxdepth 1 -name "*.app" -type d | head -1)

if [ -z "$app_source" ]; then
    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
    error "No .app found in DMG"
fi

log "Found app: $app_source"

# Copy app to /Applications
log "Installing to $INSTALL_DIR..."
if ! cp -R "$app_source" "$INSTALL_DIR/$APP_NAME"; then
    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
    error "Failed to copy app"
fi

# Unmount DMG
log "Unmounting DMG..."
hdiutil detach "$mount_point" -quiet 2>/dev/null || true

# Remove quarantine attribute if present
xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true

# Clean up downloaded DMG
log "Cleaning up..."
rm -f "$DMG_PATH" 2>/dev/null || true

log "Installation complete. Launching app..."

# Wait a bit longer to ensure clean startup
# (avoids race conditions with file handles and window state)
sleep 2

# Debug: Log environment that might affect the app
log "Environment: ELECTRON_RUN_AS_NODE=$ELECTRON_RUN_AS_NODE"
log "Environment: NODE_OPTIONS=$NODE_OPTIONS"
log "Environment: VITE_DEV_SERVER_URL=$VITE_DEV_SERVER_URL"

# Clear potentially problematic environment variables before launching
# These could be inherited from the Electron process that spawned this script
unset ELECTRON_RUN_AS_NODE
unset NODE_OPTIONS
unset VITE_DEV_SERVER_URL

# Close progress dialog before launching new app
cleanup_dialog

# Launch with minimal clean environment to avoid inheriting dev-mode settings
# Only pass essential variables (HOME, USER, PATH)
env -i HOME="$HOME" USER="$USER" PATH="/usr/bin:/bin:/usr/sbin:/sbin" open -n -a "Craft Agent"

log "Update complete!"
