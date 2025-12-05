import { useState, useCallback, useRef, useEffect } from 'react';
import { CraftAgent, type CraftAgentConfig, type AgentEvent, type Question } from '../../agent/craft-agent.ts';
import { CraftMcpProxy } from '../../mcp/client.ts';
import type { Message } from '../components/Messages.tsx';
import type { FileAttachment } from '../utils/files.ts';
import { setTerminalProgressIndeterminate, clearTerminalProgress } from '../utils/terminalProgress.ts';
import {
  isWorkspaceTokenExpired,
  updateWorkspaceOAuthTokens,
  updateWorkspaceSessionId,
  saveWorkspaceConversation,
  loadWorkspaceConversation,
  clearWorkspaceConversation,
  type Workspace,
  type StoredMessage,
} from '../../config/storage.ts';
import { CraftOAuth, getMcpBaseUrl } from '../../auth/oauth.ts';

// Helper to convert Message to StoredMessage for persistence
function messageToStoredMessage(msg: Message): StoredMessage {
  return {
    id: msg.id,
    type: msg.type,
    content: msg.content,
    timestamp: msg.timestamp,
    toolName: msg.toolName,
    toolInput: msg.toolInput,
    toolStatus: msg.toolStatus,
    toolDuration: msg.toolDuration,
    isError: msg.isError,
  };
}

// Helper to convert StoredMessage back to Message
function storedMessageToMessage(stored: StoredMessage): Message {
  return {
    id: stored.id,
    type: stored.type,
    content: stored.content,
    timestamp: stored.timestamp,
    toolName: stored.toolName,
    toolInput: stored.toolInput,
    toolStatus: stored.toolStatus,
    toolDuration: stored.toolDuration,
    isError: stored.isError,
  };
}

// Throttle streaming updates to reduce flickering
const STREAMING_THROTTLE_MS = 50;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;  // Current context size (last request's input tokens)
  costUsd: number;
}

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  command: string;
  description: string;
}

export interface AskUserQuestionRequest {
  requestId: string;
  questions: Question[];
}

export interface UseAgentResult {
  messages: Message[];
  isProcessing: boolean;
  streamingText: string;
  status: string;
  processingStartTime: number | null;
  connected: boolean;
  error: string | null;
  tokenUsage: TokenUsage;
  pendingPermission: PermissionRequest | null;
  pendingQuestion: AskUserQuestionRequest | null;
  hasExecutingTool: boolean;
  sendMessage: (input: string, attachments?: FileAttachment[]) => Promise<void>;
  clearMessages: () => void;
  interrupt: () => void;
  respondToPermission: (allowed: boolean, alwaysAllow?: boolean) => void;
  respondToQuestion: (answers: Record<string, string>) => void;
  model: string;
  setModel: (model: string) => void;
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  isWebSearchEnabled: () => boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  isWebFetchEnabled: () => boolean;
  setWebFetchEnabled: (enabled: boolean) => void;
  isCodeExecutionEnabled: () => boolean;
  setCodeExecutionEnabled: (enabled: boolean) => void;
}

export function useAgent(config: CraftAgentConfig): UseAgentResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState('');
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    contextTokens: 0,
    costUsd: 0,
  });
  const [model, setModelState] = useState(config.model || 'claude-sonnet-4-5-20250929');
  const [workspace, setWorkspaceState] = useState<Workspace>(config.workspace);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<AskUserQuestionRequest | null>(null);
  const [hasExecutingTool, setHasExecutingTool] = useState(false);

  // Track tool settings in state so they persist even before agent is created
  const [webSearchEnabled, setWebSearchEnabledState] = useState(config.enableWebSearch ?? true);
  const [webFetchEnabled, setWebFetchEnabledState] = useState(config.enableWebFetch ?? true);
  const [codeExecutionEnabled, setCodeExecutionEnabledState] = useState(config.enableCodeExecution ?? true);

  const agentRef = useRef<CraftAgent | null>(null);
  const mcpProxyRef = useRef<CraftMcpProxy | null>(null);
  const toolStartTimeRef = useRef<Map<string, number>>(new Map());
  const streamingBufferRef = useRef<string>('');
  const lastStreamingUpdateRef = useRef<number>(0);
  const streamingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptedRef = useRef<boolean>(false);

  // Initialize MCP proxy on mount and when workspace changes
  useEffect(() => {
    const initProxy = async () => {
      try {
        // Close existing proxy if any
        if (mcpProxyRef.current) {
          mcpProxyRef.current.close();
          mcpProxyRef.current = null;
        }

        // Build MCP URL from workspace
        let mcpUrl = workspace.mcpUrl;
        mcpUrl = mcpUrl.replace(/\/+$/, '');
        if (!mcpUrl.endsWith('/mcp')) {
          mcpUrl = mcpUrl.replace(/\/sse$/, '/mcp');
          if (!mcpUrl.endsWith('/mcp')) {
            mcpUrl = mcpUrl + '/mcp';
          }
        }

        // Get token for authentication from workspace
        let token: string | undefined;
        if (!workspace.isPublic && workspace.oauth) {
          if (isWorkspaceTokenExpired(workspace) && workspace.oauth.refreshToken) {
            try {
              const oauth = new CraftOAuth(
                { mcpBaseUrl: getMcpBaseUrl(workspace.mcpUrl) },
                { onStatus: () => {}, onError: () => {} }
              );
              const newTokens = await oauth.refreshAccessToken(
                workspace.oauth.refreshToken,
                workspace.oauth.clientId
              );
              updateWorkspaceOAuthTokens(workspace.id, newTokens.accessToken, newTokens.refreshToken, newTokens.expiresAt);
              token = newTokens.accessToken;
            } catch {
              token = workspace.oauth.accessToken;
            }
          } else {
            token = workspace.oauth.accessToken;
          }
        }

        // Create and initialize proxy
        const proxy = new CraftMcpProxy({
          url: mcpUrl,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        await proxy.initialize();
        mcpProxyRef.current = proxy;

        // If agent already exists, we need to recreate it with the proxy
        if (agentRef.current) {
          agentRef.current = null;
        }
      } catch (err) {
        // Proxy initialization failed - agent will fall back to HTTP config
        console.error('MCP proxy initialization failed:', err);
      }
    };

    initProxy();

    // Cleanup on unmount
    return () => {
      if (mcpProxyRef.current) {
        mcpProxyRef.current.close();
        mcpProxyRef.current = null;
      }
    };
  }, [workspace]);

  // Load saved conversation on initial mount (only if edited within last 5 minutes)
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    const savedConversation = loadWorkspaceConversation(workspace.id);
    if (savedConversation && savedConversation.messages && savedConversation.messages.length > 0) {
      // Only restore if conversation was edited within the last 5 minutes
      const fiveMinutesMs = 5 * 60 * 1000;
      const isRecent = savedConversation.savedAt && (Date.now() - savedConversation.savedAt) < fiveMinutesMs;

      if (isRecent) {
        const restoredMessages = savedConversation.messages.map(storedMessageToMessage);
        setMessages(restoredMessages);
        setTokenUsage(savedConversation.tokenUsage);
      } else {
        // Conversation is stale - clear it to start fresh
        clearWorkspaceConversation(workspace.id);
      }
    }
  }, []);  // Empty deps - only run on mount

  // Auto-save conversation when messages change and we're not processing
  useEffect(() => {
    // Skip during initial load
    if (!initialLoadDoneRef.current) return;
    // Only save if we have messages and we're not currently processing
    if (messages.length > 0 && !isProcessing) {
      const storedMessages = messages.map(messageToStoredMessage);
      saveWorkspaceConversation(workspace.id, storedMessages, tokenUsage);

      // Also save session ID if available
      const sessionId = agentRef.current?.getSessionId();
      if (sessionId) {
        updateWorkspaceSessionId(workspace.id, sessionId);
      }
    }
  }, [messages, isProcessing, workspace.id, tokenUsage]);

  const getAgent = useCallback(() => {
    if (!agentRef.current) {
      // Pass the proxy to the agent if available
      agentRef.current = new CraftAgent({
        ...config,
        mcpProxy: mcpProxyRef.current || undefined,
      });
      // Set up permission request callback
      agentRef.current.onPermissionRequest = (request) => {
        setPendingPermission(request);
      };
      // Set up AskUserQuestion callback
      agentRef.current.onAskUserQuestion = (request) => {
        setPendingQuestion(request);
      };
      // Sync current state to the newly created agent
      agentRef.current.setModel(model);
      agentRef.current.setWebSearchEnabled(webSearchEnabled);
      agentRef.current.setWebFetchEnabled(webFetchEnabled);
      agentRef.current.setCodeExecutionEnabled(codeExecutionEnabled);
      // Restore session ID from workspace if available (for conversation continuity)
      if (workspace.sessionId) {
        agentRef.current.setSessionId(workspace.sessionId);
      }
    }
    return agentRef.current;
  }, [config, model, webSearchEnabled, webFetchEnabled, codeExecutionEnabled, workspace]);

  const respondToPermission = useCallback((allowed: boolean, alwaysAllow: boolean = false) => {
    if (pendingPermission && agentRef.current) {
      agentRef.current.respondToPermission(pendingPermission.requestId, allowed, alwaysAllow);
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  const respondToQuestion = useCallback((answers: Record<string, string>) => {
    if (pendingQuestion && agentRef.current) {
      agentRef.current.respondToQuestion(pendingQuestion.requestId, answers);
      setPendingQuestion(null);
    }
  }, [pendingQuestion]);

  const sendMessage = useCallback(async (input: string, attachments?: FileAttachment[]) => {
    if (isProcessing) return;

    const agent = getAgent();

    // Add user message (include attachment names in display)
    const attachmentInfo = attachments && attachments.length > 0
      ? `\n[Attached: ${attachments.map(a => a.name).join(', ')}]`
      : '';

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        type: 'user',
        content: input + attachmentInfo,
        timestamp: Date.now(),
      },
    ]);

    setIsProcessing(true);
    setProcessingStartTime(Date.now());
    setTerminalProgressIndeterminate();
    setStreamingText('');
    setStatus('');
    setError(null);
    toolStartTimeRef.current.clear();
    streamingBufferRef.current = '';
    lastStreamingUpdateRef.current = 0;
    interruptedRef.current = false;
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }

    let assistantText = '';

    // Throttled streaming update function
    const updateStreamingText = (text: string) => {
      streamingBufferRef.current = text;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastStreamingUpdateRef.current;

      if (timeSinceLastUpdate >= STREAMING_THROTTLE_MS) {
        // Enough time has passed, update immediately
        lastStreamingUpdateRef.current = now;
        setStreamingText(text);
      } else {
        // Schedule update for later
        if (streamingTimeoutRef.current) {
          clearTimeout(streamingTimeoutRef.current);
        }
        streamingTimeoutRef.current = setTimeout(() => {
          lastStreamingUpdateRef.current = Date.now();
          setStreamingText(streamingBufferRef.current);
          streamingTimeoutRef.current = null;
        }, STREAMING_THROTTLE_MS - timeSinceLastUpdate);
      }
    };

    try {
      for await (const event of agent.chat(input, attachments)) {
        // Check if interrupted
        if (interruptedRef.current) {
          break;
        }

        switch (event.type) {
          case 'status':
            setStatus(event.message);
            break;

          case 'text_delta':
            assistantText += event.text;
            updateStreamingText(assistantText);
            setStatus('');
            // Mark any executing tools as completed when text arrives
            // (Built-in SDK tools like WebFetch don't emit tool_result events)
            // But DON'T clear toolStartTimeRef - let tool_result handle that so it can update content
            if (toolStartTimeRef.current.size > 0) {
              setHasExecutingTool(false);
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.type === 'tool' && m.toolStatus === 'executing') {
                    const toolUseId = m.id.replace('tool-', '');
                    const startTime = toolStartTimeRef.current.get(toolUseId);
                    const duration = startTime ? Date.now() - startTime : undefined;
                    // Don't delete from ref here - tool_result needs to find and update content
                    return {
                      ...m,
                      toolStatus: 'completed' as const,
                      toolDuration: duration,
                    };
                  }
                  return m;
                })
              );
            }
            break;

          case 'text_complete':
            assistantText = event.text;
            setStreamingText('');
            if (assistantText.trim()) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `assistant-${Date.now()}`,
                  type: 'assistant',
                  content: assistantText,
                  timestamp: Date.now(),
                },
              ]);
            }
            assistantText = '';
            break;

          case 'tool_start': {
            const now = Date.now();
            const toolMessageId = `tool-${event.toolUseId}`;

            // Mark any previously executing tools as completed
            // (New tool starting means previous tools must have finished)
            if (toolStartTimeRef.current.size > 0) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.type === 'tool' && m.toolStatus === 'executing' && m.id !== toolMessageId) {
                    const existingToolUseId = m.id.replace('tool-', '');
                    const startTime = toolStartTimeRef.current.get(existingToolUseId);
                    const duration = startTime ? now - startTime : undefined;
                    toolStartTimeRef.current.delete(existingToolUseId);
                    return {
                      ...m,
                      toolStatus: 'completed' as const,
                      toolDuration: duration,
                    };
                  }
                  return m;
                })
              );
            }

            toolStartTimeRef.current.set(event.toolUseId, now);
            // Clear status and mark that we have an executing tool
            setStatus('');
            setHasExecutingTool(true);
            setMessages((prev) => {
              // Check if a tool message with this ID already exists
              const existingIndex = prev.findIndex((m) => m.id === toolMessageId);
              if (existingIndex >= 0) {
                // Update existing message with better input data if available
                const existing = prev[existingIndex]!;
                const hasNewInput = event.input && Object.keys(event.input).length > 0;
                const existingHasInput = existing.toolInput && Object.keys(existing.toolInput).length > 0;
                if (hasNewInput && !existingHasInput) {
                  const updated = [...prev];
                  updated[existingIndex] = { ...existing, toolInput: event.input };
                  return updated;
                }
                return prev;
              }
              return [
                ...prev,
                {
                  id: toolMessageId,
                  type: 'tool',
                  toolName: event.toolName,
                  toolInput: event.input,
                  toolStatus: 'executing',
                  content: '',
                  timestamp: now,
                },
              ];
            });
            break;
          }

          case 'tool_result': {
            const startTime = toolStartTimeRef.current.get(event.toolUseId);
            const duration = startTime ? Date.now() - startTime : undefined;
            toolStartTimeRef.current.delete(event.toolUseId);

            // Clear executing tool flag if no more tools are running
            if (toolStartTimeRef.current.size === 0) {
              setHasExecutingTool(false);
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === `tool-${event.toolUseId}`
                  ? {
                      ...m,
                      toolStatus: event.isError ? 'error' : 'completed',
                      content: event.result,
                      isError: event.isError,
                      // Preserve existing duration if we don't have a new one
                      toolDuration: duration ?? m.toolDuration,
                      // Only use event.input if it has keys, otherwise preserve existing
                      toolInput: (event.input && Object.keys(event.input).length > 0) ? event.input : m.toolInput,
                    }
                  : m
              )
            );
            setStatus('');
            break;
          }

          case 'error':
            setError(event.message);
            setMessages((prev) => [
              ...prev,
              {
                id: `error-${Date.now()}`,
                type: 'error',
                content: event.message,
                timestamp: Date.now(),
              },
            ]);
            break;

          case 'complete':
            if (event.usage) {
              setTokenUsage((prev) => ({
                inputTokens: prev.inputTokens + event.usage!.inputTokens,
                outputTokens: prev.outputTokens + event.usage!.outputTokens,
                totalTokens:
                  prev.totalTokens +
                  event.usage!.inputTokens +
                  event.usage!.outputTokens,
                contextTokens: event.usage!.inputTokens,  // Current context size
                costUsd: prev.costUsd + (event.usage!.costUsd ?? 0),
              }));
            }
            break;
        }
      }

      setConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      if (
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('fetch failed')
      ) {
        setConnected(false);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'error',
          content: errorMessage,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      // Clean up any pending streaming timeout
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }

      // Mark any still-executing tools as completed
      // This handles cases where the SDK doesn't emit a tool_result event
      // (e.g., MCP tools, internal tools, or tools that complete silently)
      const pendingToolIds = Array.from(toolStartTimeRef.current.keys());
      if (pendingToolIds.length > 0) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.type === 'tool' && m.toolStatus === 'executing') {
              const toolUseId = m.id.replace('tool-', '');
              const startTime = toolStartTimeRef.current.get(toolUseId);
              const duration = startTime ? Date.now() - startTime : undefined;
              return {
                ...m,
                toolStatus: 'completed' as const,
                toolDuration: duration,
              };
            }
            return m;
          })
        );
      }

      clearTerminalProgress();
      setIsProcessing(false);
      setProcessingStartTime(null);
      setStreamingText('');
      setStatus('');
      setHasExecutingTool(false);
    }
  }, [getAgent, isProcessing]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setTokenUsage({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      costUsd: 0,
    });
    if (agentRef.current) {
      agentRef.current.clearHistory();
    }
    // Also clear the persisted conversation for this workspace
    clearWorkspaceConversation(workspace.id);
  }, [workspace.id]);

  const interrupt = useCallback(() => {
    // Set interrupted flag first to break out of the event loop
    interruptedRef.current = true;

    if (agentRef.current) {
      agentRef.current.interrupt();
    }
    setIsProcessing(false);
    setStreamingText('');
    setStatus('');

    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        type: 'system',
        content: 'Interrupted',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    if (agentRef.current) {
      agentRef.current.setModel(newModel);
    }
  }, []);

  const setWorkspace = useCallback((newWorkspace: Workspace) => {
    // Save current workspace's conversation before switching
    const currentMessages = messages;
    const currentSessionId = agentRef.current?.getSessionId() ?? null;

    if (currentMessages.length > 0) {
      // Save messages and token usage to storage
      const storedMessages = currentMessages.map(messageToStoredMessage);
      saveWorkspaceConversation(workspace.id, storedMessages, tokenUsage);

      // Save session ID for conversation continuity
      if (currentSessionId) {
        updateWorkspaceSessionId(workspace.id, currentSessionId);
      }
    }

    // Load target workspace's conversation
    const savedConversation = loadWorkspaceConversation(newWorkspace.id);

    if (savedConversation && savedConversation.messages && savedConversation.messages.length > 0) {
      // Restore saved messages and token usage
      const restoredMessages = savedConversation.messages.map(storedMessageToMessage);
      setMessages(restoredMessages);
      setTokenUsage(savedConversation.tokenUsage);
      setError(null);

      // Update agent with restored session ID
      if (agentRef.current) {
        agentRef.current.setWorkspace(newWorkspace, true);  // true = restore session
      }
    } else {
      // No saved conversation - start fresh
      setMessages([]);
      setError(null);
      setTokenUsage({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextTokens: 0,
        costUsd: 0,
      });

      if (agentRef.current) {
        agentRef.current.setWorkspace(newWorkspace, false);  // false = fresh start
      }
    }

    // Update workspace state (triggers useEffect to reinitialize MCP proxy)
    setWorkspaceState(newWorkspace);
  }, [messages, workspace, tokenUsage]);

  const isWebSearchEnabled = useCallback(() => {
    return webSearchEnabled;
  }, [webSearchEnabled]);

  const setWebSearchEnabled = useCallback((enabled: boolean) => {
    setWebSearchEnabledState(enabled);
    if (agentRef.current) {
      agentRef.current.setWebSearchEnabled(enabled);
    }
  }, []);

  const isWebFetchEnabled = useCallback(() => {
    return webFetchEnabled;
  }, [webFetchEnabled]);

  const setWebFetchEnabled = useCallback((enabled: boolean) => {
    setWebFetchEnabledState(enabled);
    if (agentRef.current) {
      agentRef.current.setWebFetchEnabled(enabled);
    }
  }, []);

  const isCodeExecutionEnabled = useCallback(() => {
    return codeExecutionEnabled;
  }, [codeExecutionEnabled]);

  const setCodeExecutionEnabled = useCallback((enabled: boolean) => {
    setCodeExecutionEnabledState(enabled);
    if (agentRef.current) {
      agentRef.current.setCodeExecutionEnabled(enabled);
    }
  }, []);

  return {
    messages,
    isProcessing,
    streamingText,
    status,
    processingStartTime,
    connected,
    error,
    tokenUsage,
    pendingPermission,
    pendingQuestion,
    hasExecutingTool,
    sendMessage,
    clearMessages,
    interrupt,
    respondToPermission,
    respondToQuestion,
    model,
    setModel,
    workspace,
    setWorkspace,
    isWebSearchEnabled,
    setWebSearchEnabled,
    isWebFetchEnabled,
    setWebFetchEnabled,
    isCodeExecutionEnabled,
    setCodeExecutionEnabled,
  };
}
