import { WebSocketServer, WebSocket } from 'ws';
import { BrowserWindow, Notification } from 'electron';
import { database } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import Store from 'electron-store';
import { getEncryptionKey } from './security.js';

const store = new Store({
  encryptionKey: getEncryptionKey(),
  name: 'aether-hub-config'
});

let wss: WebSocketServer | null = null;
let mainWindow: BrowserWindow | null = null;
const ADDON_PORT = 8765;

// Shared secret for browser extension connections
// Gets from store or generates a stable one
function getAddonSecret(): string {
  let secret = store.get('addon_connection_secret') as string;
  if (!secret) {
    secret = uuidv4();
    store.set('addon_connection_secret', secret);
  }
  return secret;
}

const ADDON_SECRET_KEY = getAddonSecret();

// Connected addon clients
const connectedClients: Map<string, { ws: WebSocket; browser: string; connectedAt: Date }> = new Map();

// Pending AI requests waiting for response from renderer
const pendingAIRequests: Map<string, (response: AddonResponse) => void> = new Map();

interface AddonMessage {
  id: string;
  type: string;
  action: string;
  payload?: any;
}

interface AddonResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Start the WebSocket server for browser addon communication
 */
export function startAddonServer(window: BrowserWindow): void {
  mainWindow = window;
  
  if (wss) {
    console.log('🟡 ADDON: Server already running');
    return;
  }

  try {
    wss = new WebSocketServer({ port: ADDON_PORT, host: '127.0.0.1' });

    wss.on('listening', () => {
      console.log(`🟢 ADDON: WebSocket server listening on ws://127.0.0.1:${ADDON_PORT}`);
    });

    wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      console.log(`🔵 ADDON: New connection from ${req.socket.remoteAddress}`);

      // Connection is not authenticated yet
      let isAuthenticated = false;
      let browserType = 'unknown';

      ws.on('message', async (message) => {
        try {
          const data: AddonMessage = JSON.parse(message.toString());
          console.log(`🔵 ADDON: Received message type: ${data.type}`);

          // First message must be authentication
          if (!isAuthenticated) {
            if (data.type === 'auth') {
              const storedSecret = store.get(ADDON_SECRET_KEY) as string;
              if (data.payload?.secret === storedSecret) {
                isAuthenticated = true;
                browserType = data.payload?.browser || 'unknown';
                connectedClients.set(clientId, { 
                  ws, 
                  browser: browserType,
                  connectedAt: new Date()
                });
                ws.send(JSON.stringify({
                  id: data.id,
                  success: true,
                  data: { message: 'Authenticated successfully', clientId }
                }));
                
                // Notify main window
                mainWindow?.webContents.send('addon:connected', { clientId, browser: browserType });
                console.log(`🟢 ADDON: Client ${clientId} authenticated (${browserType})`);
              } else {
                ws.send(JSON.stringify({
                  id: data.id,
                  success: false,
                  error: 'Invalid secret key'
                }));
                ws.close();
              }
            } else {
              ws.send(JSON.stringify({
                id: data.id,
                success: false,
                error: 'Authentication required'
              }));
            }
            return;
          }

          // Handle authenticated requests
          const response = await handleAddonRequest(data);
          ws.send(JSON.stringify(response));
        } catch (error) {
          console.error('🔴 ADDON: Error processing message:', error);
          ws.send(JSON.stringify({
            id: 'error',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`🟡 ADDON: Client ${clientId} disconnected`);
        connectedClients.delete(clientId);
        mainWindow?.webContents.send('addon:disconnected', { clientId });
      });

      ws.on('error', (error) => {
        console.error(`🔴 ADDON: WebSocket error for ${clientId}:`, error);
      });
    });

    wss.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.log('🟡 ADDON: Port in use, will retry in 2 seconds...');
        setTimeout(() => {
          if (mainWindow) startAddonServer(mainWindow);
        }, 2000);
      } else {
        console.error('🔴 ADDON: Server error:', error);
      }
    });
  } catch (error) {
    console.error('🔴 ADDON: Failed to start server:', error);
  }
}

/**
 * Stop the WebSocket server
 */
export function stopAddonServer(): void {
  if (wss) {
    connectedClients.forEach((client) => client.ws.close());
    connectedClients.clear();
    wss.close();
    wss = null;
    console.log('🟢 ADDON: Server stopped');
  }
}

/**
 * Generate a new connection secret for the addon
 */
export function generateAddonSecret(): string {
  const secret = uuidv4() + '-' + Date.now().toString(36);
  store.set('addon_connection_secret', secret);
  return secret;
}

/**
 * Get current connection secret
 */
export function getStoredAddonSecret(): string | null {
  return store.get('addon_connection_secret') as string | null;
}

/**
 * Get connected addon clients info
 */
export function getConnectedClients(): { id: string; browser: string; connectedAt: string }[] {
  return Array.from(connectedClients.entries()).map(([id, info]) => ({
    id,
    browser: info.browser,
    connectedAt: info.connectedAt.toISOString()
  }));
}

/**
 * Get connected addon clients count
 */
export function getConnectedClientsCount(): number {
  return connectedClients.size;
}

/**
 * Handle incoming addon requests
 */
async function handleAddonRequest(message: AddonMessage): Promise<AddonResponse> {
  const { id, type, action, payload } = message;

  try {
    switch (type) {
      case 'data':
        return await handleDataRequest(id, action, payload);
      case 'ai':
        return await handleAIRequest(id, action, payload);
      case 'notification':
        return handleNotificationRequest(id, action, payload);
      case 'save':
        return await handleSaveRequest(id, action, payload);
      case 'ping':
        return { id, success: true, data: { pong: true, timestamp: Date.now() } };
      default:
        return { id, success: false, error: `Unknown message type: ${type}` };
    }
  } catch (error) {
    return {
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle data requests (read operations)
 */
async function handleDataRequest(id: string, action: string, payload: any): Promise<AddonResponse> {
  switch (action) {
    case 'getEmails': {
      const emails = database.emails.getAll();
      return { id, success: true, data: emails.slice(0, payload?.limit || 50) };
    }

    case 'getUnreadEmails': {
      const unread = database.emails.getUnread();
      return { id, success: true, data: unread };
    }

    case 'getEvents': {
      const events = database.events.getAll();
      return { id, success: true, data: events };
    }

    case 'getTodayEvents': {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const todayEvents = database.events.getByDateRange(todayStr, tomorrowStr);
      return { id, success: true, data: todayEvents };
    }

    case 'getNotifications': {
      const notifications = database.notifications.getAll();
      return { id, success: true, data: notifications.slice(0, payload?.limit || 20) };
    }

    case 'getAccounts': {
      const accounts = database.accounts.getAll();
      // Don't send sensitive tokens to addon - use snake_case column names
      const safeAccounts = accounts.map(({ access_token, refresh_token, ...safe }) => safe);
      return { id, success: true, data: safeAccounts };
    }

    case 'getChatSessions': {
      const sessions = database.chatSessions.getAll();
      return { id, success: true, data: sessions };
    }

    case 'searchEmails': {
      const allEmails = database.emails.getAll();
      const query = payload?.query?.toLowerCase() || '';
      const matches = allEmails.filter(e => 
        e.subject.toLowerCase().includes(query) || 
        e.sender.toLowerCase().includes(query)
      );
      return { id, success: true, data: matches.slice(0, payload?.limit || 20) };
    }

    case 'getGitHubItems': {
      const ghItems = database.github.getAll();
      return { id, success: true, data: ghItems.slice(0, payload?.limit || 20) };
    }

    case 'getActions': {
      const actions = database.watchActions.getAll();
      return { id, success: true, data: actions.slice(0, payload?.limit || 50).map(transformAction) };
    }

    case 'getPendingActions': {
      const actions = database.watchActions.getByStatus('pending');
      return { id, success: true, data: actions.map(transformAction) };
    }

    case 'getActionsByStatus': {
      const actions = database.watchActions.getByStatus(payload?.status || 'pending');
      return { id, success: true, data: actions.map(transformAction) };
    }

    case 'getActionsStats': {
      const all = database.watchActions.getAll();
      const stats = {
        total: all.length,
        pending: all.filter(a => a.status === 'pending').length,
        in_progress: all.filter(a => a.status === 'in_progress').length,
        completed: all.filter(a => a.status === 'completed').length,
        dismissed: all.filter(a => a.status === 'dismissed').length
      };
      return { id, success: true, data: stats };
    }

    case 'getWatchedItems': {
      const items = database.watchedItems.getAll();
      return { id, success: true, data: items };
    }

    case 'getActiveWatches': {
      const items = database.watchedItems.getAll();
      const active = items.filter(i => i.watch_status === 'active');
      return { id, success: true, data: active };
    }

    case 'updateActionStatus': {
      const actionId = payload?.id;
      const status = payload?.status;
      if (!actionId || !status) {
        return { id, success: false, error: 'Missing id or status' };
      }
      const result = database.watchActions.updateStatus(actionId, status);
      return { id, success: result };
    }

    default:
      return { id, success: false, error: `Unknown data action: ${action}` };
  }
}

/**
 * Handle AI requests - forward to renderer for processing
 */
async function handleAIRequest(id: string, action: string, payload: any): Promise<AddonResponse> {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve({ id, success: false, error: 'Main window not available' });
      return;
    }

    // Store the resolver in pending requests map
    pendingAIRequests.set(id, resolve);

    // Send request to renderer
    mainWindow.webContents.send('addon:ai-request', { id, action, payload });
    console.log(`🔵 ADDON: Sent AI request ${id} to renderer`);

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingAIRequests.has(id)) {
        pendingAIRequests.delete(id);
        resolve({ id, success: false, error: 'AI request timeout' });
        console.log(`🟡 ADDON: AI request ${id} timed out`);
      }
    }, 60000);
  });
}

/**
 * Resolve a pending AI request (called from main.ts IPC handler)
 */
export function resolveAIRequest(id: string, success: boolean, data?: any, error?: string): void {
  const resolver = pendingAIRequests.get(id);
  if (resolver) {
    pendingAIRequests.delete(id);
    resolver({ id, success, data, error });
    console.log(`🟢 ADDON: Resolved AI request ${id}`);
  } else {
    console.log(`🟡 ADDON: No pending request found for ${id}`);
  }
}

/**
 * Handle notification requests
 */
function handleNotificationRequest(id: string, action: string, payload: any): AddonResponse {
  if (action === 'show') {
    const notification = new Notification({
      title: payload?.title || 'aethermsaid hub',
      body: payload?.body || ''
    });
    notification.show();
    return { id, success: true };
  }
  return { id, success: false, error: `Unknown notification action: ${action}` };
}

/**
 * Handle save requests (write operations)
 */
async function handleSaveRequest(id: string, action: string, payload: any): Promise<AddonResponse> {
  switch (action) {
    case 'savePageContent':
      // Save webpage content to knowledge base
      const pageId = uuidv4();
      database.knowledgeMessages.create({
        id: pageId,
        role: 'browser-addon',
        content: JSON.stringify({
          type: 'page',
          text: payload?.content || '',
          url: payload?.url,
          title: payload?.title,
          savedAt: new Date().toISOString()
        })
      });
      mainWindow?.webContents.send('addon:content-saved', { pageId, url: payload?.url });
      return { id, success: true, data: { pageId } };

    case 'saveSelection':
      // Save selected text
      const selectionId = uuidv4();
      database.knowledgeMessages.create({
        id: selectionId,
        role: 'browser-addon',
        content: JSON.stringify({
          type: 'selection',
          text: payload?.text || '',
          url: payload?.url,
          title: `Selection from ${payload?.title || 'webpage'}`,
          savedAt: new Date().toISOString()
        })
      });
      return { id, success: true, data: { selectionId } };

    case 'quickNote':
      // Save a quick note
      const noteId = uuidv4();
      database.knowledgeMessages.create({
        id: noteId,
        role: 'browser-addon',
        content: JSON.stringify({
          type: 'note',
          text: payload?.note || '',
          url: payload?.url,
          savedAt: new Date().toISOString()
        })
      });
      return { id, success: true, data: { noteId } };

    case 'updateActionStatus':
      // Update action status
      if (!payload?.actionId || !payload?.status) {
        return { id, success: false, error: 'actionId and status are required' };
      }
      database.watchActions.updateStatus(payload.actionId, payload.status);
      return { id, success: true, data: { actionId: payload.actionId, status: payload.status } };

    case 'deleteAction':
      // Delete an action
      if (!payload?.actionId) {
        return { id, success: false, error: 'actionId is required' };
      }
      database.watchActions.delete(payload.actionId);
      return { id, success: true, data: { actionId: payload.actionId } };

    default:
      return { id, success: false, error: `Unknown save action: ${action}` };
  }
}

/**
 * Send message to all connected addon clients
 */
export function broadcastToAddons(type: string, data: any): void {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });
  connectedClients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

/**
 * Transform database action record to addon format
 */
function transformAction(dbAction: any): any {
  return {
    ...dbAction,
    source_name: dbAction.item_name || 'Unknown',
    action_text: dbAction.title || dbAction.description || '',
    platform: dbAction.platform || 'unknown'
  };
}
