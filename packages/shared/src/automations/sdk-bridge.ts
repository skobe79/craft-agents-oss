/**
 * SDK Bridge - Environment variable building for Claude SDK automation integration
 *
 * Maps SDK automation input fields to ARCH_* environment variables for command execution.
 */

import { sanitizeForShell } from './security.ts';
import { cleanEnv } from './utils.ts';
import type { AgentEvent, SdkAutomationInput } from './types.ts';

/**
 * Build environment variables from SDK automation input.
 * Maps SDK input fields to ARCH_* environment variables.
 */
export function buildEnvFromSdkInput(event: AgentEvent, input: SdkAutomationInput): Record<string, string> {
  const env: Record<string, string> = {
    ...cleanEnv(),
    ARCH_EVENT: event,
  };

  // Map SDK input fields to env vars based on event type
  // User-provided values are sanitized to prevent shell injection
  switch (event) {
    case 'PreToolUse':
    case 'PostToolUse':
      if (input.tool_name) env.ARCH_TOOL_NAME = input.tool_name; // Tool names are internal, not user input
      if (input.tool_input) env.ARCH_TOOL_INPUT = sanitizeForShell(JSON.stringify(input.tool_input));
      if (input.tool_response) env.ARCH_TOOL_RESPONSE = sanitizeForShell(input.tool_response);
      break;

    case 'PostToolUseFailure':
      if (input.tool_name) env.ARCH_TOOL_NAME = input.tool_name;
      if (input.tool_input) env.ARCH_TOOL_INPUT = sanitizeForShell(JSON.stringify(input.tool_input));
      if (input.error) env.ARCH_ERROR = sanitizeForShell(input.error);
      break;

    case 'UserPromptSubmit':
      // User prompts are user-controlled and must be sanitized
      if (input.prompt) env.ARCH_PROMPT = sanitizeForShell(input.prompt);
      break;

    case 'SessionStart':
      if (input.source) env.ARCH_SOURCE = input.source; // Internal values
      if (input.model) env.ARCH_MODEL = input.model;
      break;

    case 'SubagentStart':
    case 'SubagentStop':
      if (input.agent_id) env.ARCH_AGENT_ID = input.agent_id; // Internal values
      if (input.agent_type) env.ARCH_AGENT_TYPE = input.agent_type;
      break;

    case 'Notification':
      // Notification content could contain user data
      if (input.message) env.ARCH_MESSAGE = sanitizeForShell(input.message);
      if (input.title) env.ARCH_TITLE = sanitizeForShell(input.title);
      break;

    // SessionEnd, Stop, PreCompact, PermissionRequest, Setup have no additional fields
    default:
      break;
  }

  return env;
}
