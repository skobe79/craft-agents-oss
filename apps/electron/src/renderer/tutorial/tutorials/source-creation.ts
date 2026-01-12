/**
 * Source Creation Tutorial
 *
 * Guides users through adding their first source.
 * Triggered when workspace has no sources.
 *
 * Flow:
 * 1. Click Sources in sidebar
 * 2. Click + button to add source
 * 3. Type in chat input (e.g., "connect to gmail")
 * 4. Explain permission modes and select Auto-accept
 * 5. Click Sign in with Google (when OAuth card appears)
 */

import type { TutorialDefinition } from '../types'

export const sourceCreationTutorial: TutorialDefinition = {
  id: 'source-creation',
  name: 'Adding Your First Source',
  trigger: {
    type: 'condition',
    // Condition is checked in TutorialContext based on sources.length === 0
    check: () => true,
  },
  steps: [
    {
      id: 'click-sources',
      target: '[data-tutorial="sources-nav"]',
      title: 'Your Sources',
      description:
        'Sources connect Craft Agents to your tools, files, and services. Click here to see your integrations.',
      position: 'right',
      completionEvent: 'click',
      showArrow: true,
      spotlightPadding: 6,
      spotlightRadius: 8,
    },
    {
      id: 'click-add',
      target: '[data-tutorial="add-source-button"]',
      title: 'Add a Source',
      description:
        'Click the + button to add your first source. You can connect local folders, cloud services, or MCP servers.',
      position: 'bottom',
      completionEvent: 'click',
      showArrow: true,
      spotlightPadding: 6,
      spotlightRadius: 8,
      delay: 300, // Wait for navigation to complete
    },
    {
      id: 'use-chat-input',
      target: '[data-tutorial="chat-input"]',
      title: 'Ask for Connections',
      description:
        'Just tell Craft Agents what you want to connect! Try typing "connect to gmail" and press send.',
      position: 'top',
      completionEvent: 'click',
      showArrow: true,
      spotlightPadding: 12,
      spotlightRadius: 8,
      delay: 500, // Wait for chat panel to open
    },
    {
      id: 'explain-permission-modes',
      target: '[data-tutorial="permission-mode-dropdown"]',
      title: 'Permission Modes',
      description:
        'Craft Agents has three permission modes:\n\n• Explore – Read-only, safe browsing\n• Ask – Prompts before actions (default)\n• Auto-accept – Approves all actions\n\nFor setup, click here and select "Auto-accept" to streamline the connection process.',
      position: 'bottom',
      completionEvent: 'click',
      showArrow: true,
      spotlightPadding: 8,
      spotlightRadius: 8,
      delay: 800, // Wait for message to be sent and UI to settle
    },
    {
      id: 'click-oauth-button',
      target: '[data-tutorial="oauth-sign-in-button"]',
      title: 'Authenticate with Google',
      description:
        'Click "Sign in with Google" to connect your account. A browser window will open for secure authentication.',
      position: 'top',
      completionEvent: 'click',
      showArrow: true,
      spotlightPadding: 8,
      spotlightRadius: 8,
      delay: 2000, // Wait for agent response and OAuth card to appear
    },
  ],
  onComplete: () => {
    console.log('[Tutorial] Source creation tutorial completed')
  },
  onSkip: () => {
    console.log('[Tutorial] Source creation tutorial skipped')
  },
}
