import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { addWorkspace, type Workspace, type OAuthCredentials } from '../../config/storage.ts';
import { CraftOAuth, getMcpBaseUrl } from '../../auth/oauth.ts';

// Simple text input component
const SimpleTextInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}> = ({ value, onChange, onSubmit, placeholder = '' }) => {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }

    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }

    // Handle Ctrl+U to clear
    if (input === '\x15') {
      onChange('');
      return;
    }

    // Ignore control characters
    if (key.ctrl || key.meta || key.escape || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
      return;
    }

    // Add printable characters (supports paste - multi-char input)
    if (input && input.length >= 1) {
      // Strip bracketed paste markers
      const chars = input.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
      // Filter to printable characters
      const printable = chars.split('').filter(c => c.charCodeAt(0) >= 32).join('');
      if (printable) {
        onChange(value + printable);
      }
    }
  });

  const showPlaceholder = value.length === 0;

  return (
    <Text>
      {showPlaceholder ? (
        <>
          <Text color="green">|</Text>
          <Text dimColor>{placeholder}</Text>
        </>
      ) : (
        <>
          <Text>{value}</Text>
          <Text color="green">|</Text>
        </>
      )}
    </Text>
  );
};

type AddStep = 'name' | 'url' | 'checking-auth' | 'oauth-auth' | 'complete' | 'error';

export interface WorkspaceAddProps {
  onComplete: (workspace: Workspace) => void;
  onCancel: () => void;
}

export const WorkspaceAdd: React.FC<WorkspaceAddProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<AddStep>('name');
  const [name, setName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [oauthStatus, setOauthStatus] = useState('');
  const [oauthResult, setOauthResult] = useState<OAuthCredentials | null>(null);
  const [isPublicServer, setIsPublicServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthClient, setOauthClient] = useState<CraftOAuth | null>(null);

  // Handle Ctrl+C and Escape to cancel
  useInput((input, key) => {
    if ((key.ctrl && input === 'c') || key.escape) {
      // Cancel OAuth flow if in progress
      if (oauthClient) {
        oauthClient.cancel();
        setOauthClient(null);
      }
      onCancel();
    }
  });

  const handleName = useCallback((value: string) => {
    if (!value.trim()) return;
    setName(value.trim());
    setStep('url');
  }, []);

  const handleMcpUrl = useCallback((value: string) => {
    if (!value.trim()) return;

    // Basic URL validation
    try {
      new URL(value.trim());
      setMcpUrl(value.trim());
      setStep('checking-auth');
    } catch {
      setError('Please enter a valid URL');
    }
  }, []);

  // Check if OAuth is required when entering checking-auth step
  useEffect(() => {
    if (step !== 'checking-auth' || !mcpUrl) return;

    const mcpBaseUrl = getMcpBaseUrl(mcpUrl);
    const oauth = new CraftOAuth(
      { mcpBaseUrl },
      {
        onStatus: (message) => setOauthStatus(message),
        onError: () => {},
      }
    );

    setOauthStatus('Checking server authentication requirements...');

    oauth.checkAuthRequired()
      .then((authRequired) => {
        if (authRequired) {
          setIsPublicServer(false);
          setStep('oauth-auth');
        } else {
          setIsPublicServer(true);
          // Public server - save workspace immediately
          saveWorkspace(null, true);
        }
      })
      .catch(() => {
        // If we can't check, assume it's public
        setIsPublicServer(true);
        saveWorkspace(null, true);
      });
  }, [step, mcpUrl]);

  // Start OAuth flow when entering oauth-auth step
  useEffect(() => {
    if (step !== 'oauth-auth' || !mcpUrl) return;

    const mcpBaseUrl = getMcpBaseUrl(mcpUrl);
    const oauth = new CraftOAuth(
      { mcpBaseUrl },
      {
        onStatus: (message) => setOauthStatus(message),
        onError: (errorMsg) => {
          setError(errorMsg);
          setStep('error');
        },
      }
    );

    setOauthClient(oauth);

    oauth.authenticate()
      .then(({ tokens, clientId }) => {
        const oauthCreds: OAuthCredentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          clientId,
          tokenType: tokens.tokenType,
        };
        setOauthResult(oauthCreds);
        setOauthClient(null);
        // Save workspace with OAuth credentials
        saveWorkspace(oauthCreds, false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'OAuth authentication failed');
        setOauthClient(null);
        setStep('error');
      });

    return () => {
      oauth.cancel();
    };
  }, [step, mcpUrl]);

  const saveWorkspace = useCallback((oauth: OAuthCredentials | null, isPublic: boolean) => {
    try {
      const workspace = addWorkspace({
        name,
        mcpUrl,
        oauth: oauth || undefined,
        isPublic,
      });

      setStep('complete');

      // Give user a moment to see success message
      setTimeout(() => {
        onComplete(workspace);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add workspace');
      setStep('error');
    }
  }, [name, mcpUrl, onComplete]);

  const handleRetry = useCallback(() => {
    setError(null);
    setOauthResult(null);
    setIsPublicServer(false);
    setStep('url');
  }, []);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>Add New Workspace</Text>
        <Text dimColor> - Step {getStepNumber(step)} of 3</Text>
      </Box>

      {/* Step content */}
      {step === 'name' && (
        <NameStep
          value={name}
          onChange={setName}
          onSubmit={handleName}
        />
      )}

      {step === 'url' && (
        <UrlStep
          value={mcpUrl}
          onChange={setMcpUrl}
          onSubmit={handleMcpUrl}
          error={error}
        />
      )}

      {step === 'checking-auth' && (
        <Box flexDirection="column">
          <Text>Checking server...</Text>
          <Box marginY={1}>
            <Text color="cyan">|</Text>
            <Text> {oauthStatus || 'Connecting...'}</Text>
          </Box>
        </Box>
      )}

      {step === 'oauth-auth' && (
        <Box flexDirection="column">
          <Text bold>OAuth Authorization</Text>
          <Box marginY={1}>
            <Text dimColor>
              A browser window will open for you to authorize access.
            </Text>
          </Box>
          <Box marginY={1}>
            <Text color="cyan">|</Text>
            <Text> {oauthStatus}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Complete the authorization in your browser.</Text>
          </Box>
        </Box>
      )}

      {step === 'complete' && (
        <Box flexDirection="column">
          <Text color="green" bold>Workspace added: {name}</Text>
        </Box>
      )}

      {step === 'error' && (
        <ErrorStep
          error={error}
          onRetry={handleRetry}
        />
      )}

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>Press Esc to cancel</Text>
      </Box>
    </Box>
  );
};

function getStepNumber(step: AddStep): number {
  switch (step) {
    case 'name': return 1;
    case 'url': return 2;
    case 'checking-auth':
    case 'oauth-auth':
    case 'complete':
    case 'error':
      return 3;
  }
}

// Sub-components

interface NameStepProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const NameStep: React.FC<NameStepProps> = ({ value, onChange, onSubmit }) => {
  return (
    <Box flexDirection="column">
      <Text>Give this workspace a friendly name:</Text>
      <Box marginY={1}>
        <Text dimColor>e.g., "Work Projects", "Personal Notes"</Text>
      </Box>
      <Box>
        <Text color="green">&gt; </Text>
        <SimpleTextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="My Workspace"
        />
      </Box>
    </Box>
  );
};

interface UrlStepProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  error: string | null;
}

const UrlStep: React.FC<UrlStepProps> = ({ value, onChange, onSubmit, error }) => {
  return (
    <Box flexDirection="column">
      <Text>Enter the Craft MCP server URL:</Text>
      {error && (
        <Box marginY={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="green">&gt; </Text>
        <SimpleTextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="https://mcp.craft.do/links/YOUR_LINK_ID"
        />
      </Box>
    </Box>
  );
};

interface ErrorStepProps {
  error: string | null;
  onRetry: () => void;
}

const ErrorStep: React.FC<ErrorStepProps> = ({ error, onRetry }) => {
  useInput((input, key) => {
    if (key.return) {
      onRetry();
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="red" bold>Failed to add workspace</Text>
      <Text color="red">{error}</Text>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to retry</Text>
      </Box>
    </Box>
  );
};
