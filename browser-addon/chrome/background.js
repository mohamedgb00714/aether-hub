/**
 * aethermsaid hub Browser Addon - Background Service Worker
 * Manages WebSocket connection to Electron app and side panel
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
  const stored = await chrome.storage.local.get(['aether-hub_secret']);
  connectionSecret = stored.aether-hub_secret || null;
  
  // Set up side panel behavior - open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  
  // Attempt connection if secret exists
  if (connectionSecret) {
    connect();
  }
  
  console.log('🟢 aethermsaid hub Addon initialized');
}

// Create context menus only on install/update to avoid duplicate ID errors
chrome.runtime.onInstalled.addListener(() => {
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
      // Authenticate with secret
      sendMessage({
        type: 'auth',
        payload: { secret: connectionSecret, browser: 'chrome' }
      }).then(response => {
        if (response.success) {
          isConnected = true;
          reconnectAttempts = 0;
          updateBadge('connected');
          notifySidePanel({ type: 'connection', status: 'connected' });
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
        
        // Check if this is a response to a pending request
        if (data.id && pendingRequests.has(data.id)) {
          const { resolve } = pendingRequests.get(data.id);
          pendingRequests.delete(data.id);
          resolve(data);
        } else {
          // Handle push notifications from server
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
      notifySidePanel({ type: 'connection', status: 'disconnected' });
      
      // Attempt reconnection
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
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    ws.close();
  }
  connectionSecret = null;
  chrome.storage.local.remove(['aether-hub_secret']);
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
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: data.data?.title || 'aethermsaid hub',
        message: data.data?.body || ''
      });
      break;
    case 'newEmail':
      notifySidePanel({ type: 'newEmail', data: data.data });
      break;
    case 'newEvent':
      notifySidePanel({ type: 'newEvent', data: data.data });
      break;
  }
}

/**
 * Create context menus
 */
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'aether-hub-save-selection',
      title: 'Save selection to aethermsaid hub',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'aether-hub-save-page',
      title: 'Save page to aethermsaid hub',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'aether-hub-ask-ai',
      title: 'Ask aethermsaid hub about this',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'aether-hub-summarize',
      title: 'Summarize with aethermsaid hub',
      contexts: ['page']
    });
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Ensure we have latest secret from storage (service worker may have been suspended)
  if (!connectionSecret) {
    const stored = await chrome.storage.local.get(['aether-hub_secret']);
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
      chrome.sidePanel.open({ tabId: tab.id });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'aethermsaid hub',
        message: 'Please connect to aethermsaid hub first. Click the extension icon to open the panel.'
      });
    } else {
      chrome.notifications.create({
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
        chrome.notifications.create({
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
      // Get page content via content script
      chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
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
            chrome.notifications.create({
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
      // Store the selected text and open side panel
      chrome.storage.local.set({ pendingQuestion: info.selectionText });
      chrome.sidePanel.open({ tabId: tab.id });
      break;
      
    case 'aether-hub-summarize':
      // Request summarization
      chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
        if (response) {
          chrome.storage.local.set({ 
            pendingSummarize: {
              content: response.content,
              url: tab.url,
              title: tab.title
            }
          });
          chrome.sidePanel.open({ tabId: tab.id });
        }
      });
      break;
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && isConnected) {
      chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
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
            chrome.notifications.create({
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

// Message handler from side panel and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse);
  return true; // Indicates async response
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'connect':
      connectionSecret = request.secret;
      await chrome.storage.local.set({ aether-hub_secret: request.secret });
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
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Notify side panel of state changes
 */
function notifySidePanel(data) {
  chrome.runtime.sendMessage(data).catch(() => {
    // Side panel might not be open, ignore error
  });
}

/**
 * Generate unique ID
 */
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Initialize on install/startup
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

// Initialize immediately
initialize();
