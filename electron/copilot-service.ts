
import { CopilotClient, CopilotSession } from '@github/copilot-sdk';
import Store from 'electron-store';
import { getEncryptionKey } from './security.js';
import { spawn } from 'child_process';
import { shell } from 'electron';

const store = new Store({
  encryptionKey: getEncryptionKey(),
  name: 'aether-hub-config'
});

export interface CopilotSessionInfo {
    id: string;
    projectPath: string;
    agentType: string;
    tools: string[];
    status: 'idle' | 'running' | 'error';
    lastAction?: string;
    systemPrompt?: string;
}

class CopilotService {
  private client: CopilotClient | null = null;
  private readonly sessions: Map<string, CopilotSession> = new Map();
  private readonly sessionMetadata: Map<string, CopilotSessionInfo> = new Map();
  private eventCallback: ((event: { sessionId: string; type: string; data: any }) => void) | null = null;

  /** Register a callback for forwarding tool/agent events to the renderer */
  setEventCallback(cb: (event: { sessionId: string; type: string; data: any }) => void) {
    this.eventCallback = cb;
  }

  /** Auto-approve all permission requests so the agent can actually execute tools */
  private permissionHandler = async (request: any) => {
    console.log(`🤖 Copilot: Permission requested: ${request.kind}`, request);
    return { kind: 'approved' as const };
  };

  /** Handle user input requests — for now, provide a default non-interactive response */
  private userInputHandler = async (request: any) => {
    console.log(`🤖 Copilot: User input requested:`, request.question);
    // In future, forward to renderer for interactive input
    return { answer: 'proceed', wasFreeform: true };
  };

  private async ensureClient() {
    if (this.client?.getState() === 'connected') return this.client;
    
    try {
      const apiKey = store.get('github_copilot_api_key') as string | undefined;
      
      const clientOptions: any = {};
      if (apiKey) {
        console.log('Using configured GitHub/Copilot API token');
        clientOptions.githubToken = apiKey;
        clientOptions.useLoggedInUser = false;
      } else {
        console.log('No API token configured, using system login');
        clientOptions.useLoggedInUser = true;
      }

      this.client = new CopilotClient(clientOptions);
      await this.client.start();
      console.log('GitHub Copilot SDK initialized');
      return this.client;
    } catch (error) {
      console.error('Failed to start Copilot Client:', error);
      throw error;
    }
  }

  async signIn(onStatus: (data: { status: string, code?: string, message?: string }) => void) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Starting Copilot Auth Login flow...');
        // Using -i as requested by user, though regular 'auth login' is often interactive
        const child = spawn('copilot', ['-i', 'auth', 'login']);

        child.stdout.on('data', (data) => {
          const output = data.toString();
          console.log(`Copilot CLI: ${output}`);

          // Extract device code (e.g., 638C-F27A)
          const codeMatch = output.match(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
          if (codeMatch) {
            onStatus({ status: 'needs_auth', code: codeMatch[0] });
            
            // Auto open browser if URL is present or just default to device login
            if (output.includes('https://github.com/login/device')) {
               shell.openExternal('https://github.com/login/device');
            }
          }

          if (output.includes('Press Enter to open')) {
            child.stdin.write('\n');
          }

          // Check for successful authentication
          if (output.includes('Signed in successfully') || output.includes('Authentication successful')) {
            onStatus({ status: 'success', message: 'Successfully authenticated!' });
            resolve(true);
          }
        });

        child.stderr.on('data', (data) => {
          const error = data.toString();
          console.error(`Copilot CLI Error: ${error}`);
          if (error.includes('command not found')) {
            onStatus({ status: 'error', message: 'GitHub Copilot CLI not found. Please install it with: npm install -g @github/copilot' });
          }
        });

        child.on('error', (err) => {
          console.error('Failed to spawn Copilot CLI:', err);
          onStatus({ status: 'error', message: 'Failed to start Copilot CLI. Is it installed?' });
          reject(err);
        });

        child.on('close', (code) => {
          if (code !== 0) {
            console.log(`Copilot CLI auth process exited with code ${code}`);
            // Don't reject if we already succeeded or are waiting for user
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async createSession(options: {
    projectPath: string;
    agentType: string;
    tools: string[];
    model?: string;
    sessionId?: string;
    systemPrompt?: string;
  }) {
    const client = await this.ensureClient();
    
    console.log(`🤖 Copilot: Creating session with options:`, options);
    
    // Use provided sessionId (for restoration) or generate a new one
    let sessionId: string;
    if (options.sessionId) {
      sessionId = options.sessionId;
    } else {
      const projectName = options.projectPath.split('/').pop() || 'project';
      const timestamp = Date.now();
      sessionId = `${projectName}-${options.agentType}-${timestamp}`;
    }
    
    console.log(`🤖 Copilot: Using session ID: ${sessionId}`);
    
    // Create session with custom ID and working directory
    const sessionConfig: any = {
      sessionId: sessionId,
      model: options.model || 'gpt-4o',
      availableTools: options.tools,
      workingDirectory: options.projectPath,
      configDir: options.projectPath,
      onPermissionRequest: this.permissionHandler,
      onUserInputRequest: this.userInputHandler,
    };

    // Use systemMessage (SDK's supported field) instead of 'instructions' (not valid)
    if (options.systemPrompt) {
      sessionConfig.systemMessage = {
        mode: 'append' as const,
        content: options.systemPrompt,
      };
    }

    // Log tool configuration for debugging
    console.log(`🤖 Copilot: Creating session with ${options.tools.length} tools:`, options.tools);
    console.log(`🤖 Copilot: Permission handler:`, !!this.permissionHandler);
    console.log(`🤖 Copilot: User input handler:`, !!this.userInputHandler);

    const session = await client.createSession(sessionConfig);
    console.log(`🤖 Copilot: Session created successfully with ID: ${sessionId}`);
    
    this.sessions.set(sessionId, session);
    this.sessionMetadata.set(sessionId, {
        id: sessionId,
        projectPath: options.projectPath,
        agentType: options.agentType,
        tools: options.tools,
        status: 'idle',
        systemPrompt: options.systemPrompt
    });

    return sessionId;
  }

  /**
   * Resume an existing session using the SDK's resumeSession (preserves server-side history).
   * Falls back to createSession if resumption fails (e.g. session expired on server).
   */
  async resumeSession(options: {
    sessionId: string;
    projectPath: string;
    agentType: string;
    tools: string[];
    model?: string;
    systemPrompt?: string;
    chatHistory?: Array<{ role: string; content: string }>;
  }) {
    const client = await this.ensureClient();
    const sessionId = options.sessionId;

    console.log(`🤖 Copilot: Attempting to resume session ${sessionId}`);
    console.log(`🤖 Copilot: Resuming with ${options.tools.length} tools:`, options.tools);
    console.log(`🤖 Copilot: Model: ${options.model || 'gpt-4o'}`);
    console.log(`🤖 Copilot: Permission handler:`, !!this.permissionHandler);
    console.log(`🤖 Copilot: User input handler:`, !!this.userInputHandler);

    // Build config for both resume and fallback create
    const resumeConfig: any = {
      model: options.model || 'gpt-4o',
      availableTools: options.tools,
      workingDirectory: options.projectPath,
      configDir: options.projectPath,
      onPermissionRequest: this.permissionHandler,
      onUserInputRequest: this.userInputHandler,
    };

    if (options.systemPrompt) {
      resumeConfig.systemMessage = {
        mode: 'append' as const,
        content: options.systemPrompt,
      };
    }

    let session: CopilotSession;
    let resumed = false;

    try {
      // Try SDK resumeSession first — preserves full server-side conversation history
      session = await client.resumeSession(sessionId, resumeConfig);
      resumed = true;
      console.log(`🤖 Copilot: Session ${sessionId} resumed via SDK (server-side history preserved)`);
    } catch (resumeErr) {
      console.warn(`🤖 Copilot: resumeSession failed for ${sessionId}, creating new session:`, (resumeErr as Error).message);

      // Fallback: create a fresh session with the same ID
      session = await client.createSession({
        sessionId: sessionId,
        ...resumeConfig,
      });

      // Inject chat history as context so the model knows the prior conversation
      if (options.chatHistory && options.chatHistory.length > 0) {
        console.log(`🤖 Copilot: Injecting ${options.chatHistory.length} messages as context`);

        // Build a concise summary of prior conversation
        const historyContext = options.chatHistory
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const contextPrompt = `[CONVERSATION HISTORY - This is the prior conversation in this session. Use it as context for the user's next message, but do NOT repeat it.]\n\n${historyContext}\n\n[END OF HISTORY - Respond normally to the user's next message.]`;

        try {
          await session.sendAndWait({ prompt: contextPrompt }, 60000);
          console.log(`🤖 Copilot: Chat history injected successfully`);
        } catch (historyErr) {
          console.warn(`🤖 Copilot: Failed to inject history, continuing without it:`, (historyErr as Error).message);
        }
      }
    }

    this.sessions.set(sessionId, session);
    this.sessionMetadata.set(sessionId, {
      id: sessionId,
      projectPath: options.projectPath,
      agentType: options.agentType,
      tools: options.tools,
      status: 'idle',
      systemPrompt: options.systemPrompt,
    });

    return { sessionId, resumed };
  }

  async sendRequest(sessionId: string, prompt: string, onUpdate?: (chunk: string) => void) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const meta = this.sessionMetadata.get(sessionId);
    if (meta) meta.status = 'running';

    try {
        console.log(`🤖 Copilot: Sending request to session ${sessionId}`);
        console.log(`🤖 Copilot: Prompt:`, prompt);
        
        let fullResponse = '';
        
        // Subscribe to assistant message delta events for streaming
        const unsubscribe = session.on((event: any) => {
          console.log(`🤖 Copilot: Event received:`, event.type);
          
          if (event.type === 'assistant.message_delta') {
            const chunk = event.data?.deltaContent || event.data?.content || '';
            if (chunk) {
              fullResponse += chunk;
              if (onUpdate) {
                onUpdate(chunk);
              }
            }
          } else if (event.type === 'assistant.message') {
            const content = event.data?.content || '';
            if (content && !fullResponse) {
              fullResponse = content;
              if (onUpdate) {
                onUpdate(content);
              }
            }
          } else if (event.type === 'tool.execution_started' || event.type === 'tool.call') {
            // Forward tool execution events to renderer for visibility
            const toolName = event.data?.toolName || event.data?.name || 'unknown';
            console.log(`🤖 Copilot: Tool executing: ${toolName}`);
            if (this.eventCallback) {
              this.eventCallback({ sessionId, type: event.type, data: event.data });
            }
          } else if (event.type === 'tool.execution_complete') {
            const toolName = event.data?.toolName || 'unknown';
            const success = event.data?.success;
            console.log(`🤖 Copilot: Tool completed: ${toolName} (success: ${success})`);
            if (this.eventCallback) {
              this.eventCallback({ sessionId, type: event.type, data: event.data });
            }
          } else if (event.type === 'session.error') {
            console.error(`🤖 Copilot: Session error:`, event.data?.message);
          }
        });
        
        try {
          // Use sendAndWait - it waits for the complete response
          const response = await session.sendAndWait({ prompt }, 120000); // 2 minute timeout
          
          console.log(`🤖 Copilot: SendAndWait completed:`, response);
          
          // If we didn't get the response via events, extract it from the return value
          if (!fullResponse && response) {
            if (typeof response === 'string') {
              fullResponse = response;
            } else if (typeof response === 'object') {
              const respObj = response as any;
              fullResponse = respObj.text || respObj.content || respObj.message || '';
            }
            
            if (fullResponse && onUpdate) {
              onUpdate(fullResponse);
            }
          }
          
        } finally {
          // Unsubscribe from events
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        }
        
        if (!fullResponse) {
          console.warn(`🤖 Copilot: No response received from SDK`);
          fullResponse = '❌ No response received from Copilot. The session may have timed out.';
        }
        
        console.log(`🤖 Copilot: Final response length:`, fullResponse.length);
        
        if (meta) meta.status = 'idle';
        return fullResponse;
        
    } catch (error) {
        console.error('🤖 Copilot: Error in sendRequest:', error);
        if (meta) meta.status = 'error';
        
        const errorMsg = `❌ Error: ${(error as Error).message}`;
        if (onUpdate) {
          onUpdate(errorMsg);
        }
        
        throw error;
    }
  }

  async stopSession(sessionId: string) {
    this.sessions.delete(sessionId);
    this.sessionMetadata.delete(sessionId);
  }

  isSessionActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  async getAuthStatus() {
    try {
      const client = await this.ensureClient();
      
      // Use the SDK's getAuthStatus method
      const auth = await client.getAuthStatus();
      
      return {
        authenticated: auth.isAuthenticated || false,
        user: auth.login ? { login: auth.login } : null,
        state: client.getState(),
        statusMessage: auth.statusMessage
      };
    } catch (error) {
      return {
        authenticated: false,
        state: 'error',
        error: (error as Error).message
      };
    }
  }

  async initiateOAuthFlow() {
    const authUrl = 'https://github.com/login/device';
    await shell.openExternal(authUrl);
    return { success: true, url: authUrl };
  }

  async listModels() {
    try {
      const client = await this.ensureClient();
      const models = await client.listModels();
      console.log("🤖 Copilot: Available models:", models);
      return models;
    } catch (error) {
      console.error("🤖 Copilot: Failed to fetch models:", error);
      // Return sensible defaults if SDK fails or offline
      return [
        { id: 'gpt-4o', name: 'GPT-4o (Default)' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'o1-preview', name: 'o1 Preview' },
        { id: 'o1-mini', name: 'o1 Mini' }
      ];
    }
  }

  listSessions(): CopilotSessionInfo[] {
    return Array.from(this.sessionMetadata.values());
  }
}

export const copilotService = new CopilotService();
