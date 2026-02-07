/**
 * aethermsaid hub Browser Addon - Firefox Background Script
 * Manages WebSocket connection to Electron app
 */

const AETHER_HUB_WS_URL = 'ws://127.0.0.1:8765';
const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
let pendingRequests = new Map();
let connectionSecret = null;

/**
 * Initialize the addon
 */
async function initialize() {
  // Load secret from storage
  const stored = await browser.storage.local.get(['aether-hub_secret']);
  connectionSecret = stored.aether-hub_secret || null;
  
  // Attempt connection if secret exists
  if (connectionSecret) {
    connect();
  }
  
  console.log('🟢 aethermsaid hub Firefox Addon initialized');
}

// Create context menus only on install/update to avoid duplicate ID errors
browser.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

/**
 * Connect to aethermsaid hub Electron app
 */
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('🟡 Already connected');
    return;
  }

  console.log('🔵 Connecting to aethermsaid hub...');
  
  try {
    ws = new WebSocket(AETHER_HUB_WS_URL);
    
    ws.onopen = () => {
      console.log('🟢 WebSocket connected, authenticating...');
      sendMessage({
        type: 'auth',
        payload: { secret: connectionSecret, browser: 'firefox' }
      }).then(response => {
        if (response.success) {
          isConnected = true;
          reconnectAttempts = 0;
          updateBadge('connected');
          notifySidebar({ type: 'connection', status: 'connected' });
          console.log('🟢 Authenticated successfully');
        } else {
          console.error('🔴 Authentication failed:', response.error);
          ws.close();
        }
      });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.id && pendingRequests.has(data.id)) {
          const { resolve } = pendingRequests.get(data.id);
          pendingRequests.delete(data.id);
          resolve(data);
        } else {
          handleServerPush(data);
        }
      } catch (error) {
        console.error('🔴 Error parsing message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('🟡 WebSocket disconnected');
      isConnected = false;
      ws = null;
      updateBadge('disconnected');
      notifySidebar({ type: 'connection', status: 'disconnected' });
      
      if (connectionSecret && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔵 Reconnecting in ${RECONNECT_INTERVAL}ms (attempt ${reconnectAttempts})`);
        setTimeout(connect, RECONNECT_INTERVAL);
      }
    };
    
    ws.onerror = (error) => {
      console.error('🔴 WebSocket error:', error);
    };
  } catch (error) {
    console.error('🔴 Connection error:', error);
  }
}

/**
 * Disconnect from aethermsaid hub
 */
function disconnect() {
  if (ws) {
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
    ws.close();
  }
  connectionSecret = null;
  browser.storage.local.remove(['aether-hub_secret']);
}

/**
 * Send message and wait for response
 */
function sendMessage(data) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected to aethermsaid hub'));
      return;
    }
    
    const id = generateId();
    const message = { ...data, id };
    
    pendingRequests.set(id, { resolve, reject });
    ws.send(JSON.stringify(message));
    console.log('Sent message:', id, data.type, data.action);
    
    // Timeout after 90 seconds for AI requests, 30 seconds for others
    const timeout = data.type === 'ai' ? 90000 : 30000;
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, timeout);
  });
}

/**
 * Handle push notifications from server
 */
function handleServerPush(data) {
  switch (data.type) {
    case 'notification':
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: data.data?.title || 'aethermsaid hub',
        message: data.data?.body || ''
      });
      break;
    case 'newEmail':
      notifySidebar({ type: 'newEmail', data: data.data });
      break;
    case 'newEvent':
      notifySidebar({ type: 'newEvent', data: data.data });
      break;
  }
}

/**
 * Create context menus
 */
function createContextMenus() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'aether-hub-save-selection',
      title: 'Save selection to aethermsaid hub',
      contexts: ['selection']
    });
    
    browser.contextMenus.create({
      id: 'aether-hub-save-page',
      title: 'Save page to aethermsaid hub',
      contexts: ['page']
    });
    
    browser.contextMenus.create({
      id: 'aether-hub-ask-ai',
      title: 'Ask aethermsaid hub about this',
      contexts: ['selection']
    });
    
    browser.contextMenus.create({
      id: 'aether-hub-summarize',
      title: 'Summarize with aethermsaid hub',
      contexts: ['page']
    });
  });
}

// Context menu click handler
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  // Ensure we have latest secret from storage
  if (!connectionSecret) {
    const stored = await browser.storage.local.get(['aether-hub_secret']);
    connectionSecret = stored.aether-hub_secret || null;
  }
  
  // If not connected but have secret, try to connect first
  if (!isConnected && connectionSecret) {
    console.log('🔵 Context menu used while disconnected, attempting auto-connect...');
    
    // Force new connection
    if (ws) {
      ws.close();
      ws = null;
    }
    connect();
    
    // Wait for connection (up to 5 seconds)
    let waitTime = 0;
    while (!isConnected && waitTime < 5000) {
      await new Promise(r => setTimeout(r, 100));
      waitTime += 100;
    }
  }
  
  if (!isConnected) {
    // Check if we even have a secret
    if (!connectionSecret) {
      browser.sidebarAction.open();
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'aethermsaid hub',
        message: 'Please connect to aethermsaid hub first. Open the sidebar to connect.'
      });
    } else {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'aethermsaid hub',
        message: 'Could not connect to aethermsaid hub. Make sure the desktop app is running.'
      });
    }
    return;
  }
  
  switch (info.menuItemId) {
    case 'aether-hub-save-selection':
      try {
        await sendMessage({
          type: 'save',
          action: 'saveSelection',
          payload: {
            text: info.selectionText,
            url: tab.url,
            title: tab.title
          }
        });
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'aethermsaid hub',
          message: 'Selection saved to knowledge base!'
        });
      } catch (error) {
        console.error('Failed to save selection:', error);
      }
      break;
      
    case 'aether-hub-save-page':
      browser.tabs.sendMessage(tab.id, { action: 'getPageContent' }).then(async (response) => {
        if (response) {
          try {
            await sendMessage({
              type: 'save',
              action: 'savePageContent',
              payload: {
                content: response.content,
                url: tab.url,
                title: tab.title
              }
            });
            browser.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'aethermsaid hub',
              message: 'Page saved to knowledge base!'
            });
          } catch (error) {
            console.error('Failed to save page:', error);
          }
        }
      });
      break;
      
    case 'aether-hub-ask-ai':
      browser.storage.local.set({ pendingQuestion: info.selectionText });
      browser.sidebarAction.open();
      break;
      
    case 'aether-hub-summarize':
      browser.tabs.sendMessage(tab.id, { action: 'getPageContent' }).then(async (response) => {
        if (response) {
          browser.storage.local.set({ 
            pendingSummarize: {
              content: response.content,
              url: tab.url,
              title: tab.title
            }
          });
          browser.sidebarAction.open();
        }
      });
      break;
  }
});

// Browser action click - open sidebar
browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.open();
});

// Keyboard shortcut handler
browser.commands.onCommand.addListener(async (command) => {
  if (command === 'save-page') {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && isConnected) {
      browser.tabs.sendMessage(tab.id, { action: 'getPageContent' }).then(async (response) => {
        if (response) {
          try {
            await sendMessage({
              type: 'save',
              action: 'savePageContent',
              payload: {
                content: response.content,
                url: tab.url,
                title: tab.title
              }
            });
            browser.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: 'aethermsaid hub',
              message: 'Page saved to knowledge base!'
            });
          } catch (error) {
            console.error('Failed to save page:', error);
          }
        }
      });
    }
  }
});

// Message handler from sidebar and content scripts
browser.runtime.onMessage.addListener((request, sender) => {
  return handleMessage(request, sender);
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'connect':
      connectionSecret = request.secret;
      await browser.storage.local.set({ aether-hub_secret: request.secret });
      connect();
      return { success: true };
      
    case 'disconnect':
      disconnect();
      return { success: true };
      
    case 'getStatus':
      return { 
        isConnected,
        hasSecret: !!connectionSecret
      };
      
    case 'sendRequest':
      if (!isConnected) {
        return { success: false, error: 'Not connected' };
      }
      try {
        return await sendMessage(request.data);
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getEmails':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getUnreadEmails' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getEvents':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getTodayEvents' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getTodayEvents':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getTodayEvents' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'askAI':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({
          type: 'ai',
          action: 'chat',
          payload: { message: request.message }
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'quickNote':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({
          type: 'save',
          action: 'quickNote',
          payload: { note: request.note, url: sender.tab?.url }
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'saveCurrentPage':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({
          type: 'save',
          action: 'savePageContent',
          payload: request.payload
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getActions':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getActions' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getPendingActions':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getPendingActions' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getActionsByStatus':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getActionsByStatus', payload: { status: request.status } });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'getActionsStats':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'getActionsStats' });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    case 'updateActionStatus':
      if (!isConnected) return { success: false, error: 'Not connected' };
      try {
        return await sendMessage({ type: 'data', action: 'updateActionStatus', payload: { id: request.id, status: request.status } });
      } catch (error) {
        return { success: false, error: error.message };
      }
      
    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Update badge to show connection status
 */
function updateBadge(status) {
  if (status === 'connected') {
    browser.browserAction.setBadgeText({ text: '✓' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
}

/**
 * Notify sidebar of state changes
 */
function notifySidebar(data) {
  browser.runtime.sendMessage(data).catch(() => {
    // Sidebar might not be open
  });
}

/**
 * Generate unique ID
 */
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Initialize
initialize();
