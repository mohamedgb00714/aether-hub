/**
 * aethermsaid hub Browser Addon - Firefox Sidebar Script
 * Uses browser.* API instead of api.*
 */

// Firefox uses 'browser' API
const api = typeof browser !== 'undefined' ? browser : chrome;

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const connectionSection = document.getElementById('connection-section');
const connectedSection = document.getElementById('connected-section');
const secretInput = document.getElementById('secret-input');
const connectBtn = document.getElementById('connect-btn');

// Tab elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Dashboard elements
const unreadCount = document.getElementById('unread-count');
const eventsCount = document.getElementById('events-count');
const savePageBtn = document.getElementById('save-page-btn');
const quickNoteBtn = document.getElementById('quick-note-btn');
const refreshBtn = document.getElementById('refresh-btn');
const openAppBtn = document.getElementById('open-app-btn');
const aiNotificationsEl = document.getElementById('ai-notifications');

// Chat elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Save elements
const currentPageInfo = document.getElementById('current-page-info');
const saveCurrentPageBtn = document.getElementById('save-current-page-btn');
const noteTextarea = document.getElementById('note-textarea');
const saveNoteBtn = document.getElementById('save-note-btn');

// Settings elements
const settingsStatus = document.getElementById('settings-status');
const disconnectBtn = document.getElementById('disconnect-btn');

// Actions elements
const actionsList = document.getElementById('actions-list');
const actionsFilter = document.getElementById('actions-filter');
const refreshActionsBtn = document.getElementById('refresh-actions-btn');
const pendingActionsCount = document.getElementById('pending-actions-count');
const inProgressActionsCount = document.getElementById('in-progress-actions-count');
const completedActionsCount = document.getElementById('completed-actions-count');

// State
let isConnected = false;
let currentPageData = null;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 seconds

/**
 * Initialize side panel
 */
async function init() {
  // Check connection status
  const status = await api.runtime.sendMessage({ action: 'getStatus' });
  updateConnectionState(status.isConnected);
  
  // Load pending data
  const stored = await api.storage.local.get(['pendingQuestion', 'pendingSummarize']);
  if (stored.pendingQuestion) {
    switchTab('chat');
    chatInput.value = `Explain this: "${stored.pendingQuestion}"`;
    api.storage.local.remove(['pendingQuestion']);
    chatInput.focus();
  }
  if (stored.pendingSummarize) {
    switchTab('chat');
    addChatMessage('user', `Summarize this page: ${stored.pendingSummarize.title}`);
    sendAIRequest(`Please summarize the following content from ${stored.pendingSummarize.url}:\n\n${stored.pendingSummarize.content.substring(0, 5000)}`);
    api.storage.local.remove(['pendingSummarize']);
  }
  
  // Load current page info
  loadCurrentPageInfo();
  
  // If connected, load data and start auto-refresh
  if (status.isConnected) {
    loadDashboardData();
    loadActionsData();
    startAutoRefresh();
  }
  
  // Set up tab navigation
  setupTabNavigation();
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Update UI based on connection state
 */
function updateConnectionState(connected) {
  isConnected = connected;
  
  if (connected) {
    statusIndicator.classList.remove('disconnected');
    statusIndicator.classList.add('connected');
    statusIndicator.title = 'Connected';
    connectionSection.classList.add('hidden');
    connectedSection.classList.remove('hidden');
    settingsStatus.textContent = 'Connected';
    settingsStatus.classList.add('connected');
  } else {
    statusIndicator.classList.add('disconnected');
    statusIndicator.classList.remove('connected');
    statusIndicator.title = 'Disconnected';
    connectionSection.classList.remove('hidden');
    connectedSection.classList.add('hidden');
    settingsStatus.textContent = 'Disconnected';
    settingsStatus.classList.remove('connected');
  }
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

/**
 * Switch to a specific tab
 */
function switchTab(tabName) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(`tab-${tabName}`);
  
  if (activeTab) activeTab.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Connect button
  connectBtn.addEventListener('click', handleConnect);
  secretInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleConnect();
  });
  
  // Dashboard actions
  savePageBtn?.addEventListener('click', () => saveCurrentPage());
  quickNoteBtn?.addEventListener('click', () => switchTab('save'));
  refreshBtn?.addEventListener('click', () => loadDashboardData());
  openAppBtn?.addEventListener('click', () => {
    api.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'aethermsaid hub',
      message: 'Please open aethermsaid hub desktop app manually'
    });
  });
  
  // Chat
  sendBtn?.addEventListener('click', handleSendChat);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendChat();
  });
  
  // Save tab
  saveCurrentPageBtn?.addEventListener('click', () => saveCurrentPage());
  saveNoteBtn?.addEventListener('click', handleSaveNote);
  
  // Settings
  disconnectBtn?.addEventListener('click', handleDisconnect);
  
  // Actions tab
  refreshActionsBtn?.addEventListener('click', () => loadActionsData());
  actionsFilter?.addEventListener('change', () => loadActionsData());
}

/**
 * Handle connect button click
 */
async function handleConnect() {
  const secret = secretInput.value.trim();
  if (!secret) {
    showNotification('Please enter the connection secret');
    return;
  }
  
  connectBtn.disabled = true;
  connectBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
    Connecting...
  `;
  
  try {
    await api.runtime.sendMessage({ action: 'connect', secret });
    
    // Wait for connection to establish
    setTimeout(async () => {
      const status = await api.runtime.sendMessage({ action: 'getStatus' });
      updateConnectionState(status.isConnected);
      
      if (status.isConnected) {
        loadDashboardData();
        loadActionsData();
        startAutoRefresh();
      } else {
        showNotification('Connection failed. Check the secret and ensure aethermsaid hub is running.');
      }
      
      connectBtn.disabled = false;
      connectBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
          <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
        </svg>
        Connect
      `;
    }, 2000);
  } catch (error) {
    showNotification('Connection failed: ' + error.message);
    connectBtn.disabled = false;
    connectBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
        <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
      </svg>
      Connect
    `;
  }
}

/**
 * Handle disconnect
 */
async function handleDisconnect() {
  stopAutoRefresh();
  await api.runtime.sendMessage({ action: 'disconnect' });
  updateConnectionState(false);
  secretInput.value = '';
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
  // Clear any existing interval
  stopAutoRefresh();
  
  // Start new interval
  autoRefreshInterval = setInterval(async () => {
    if (isConnected) {
      console.log('[aethermsaid hub] Auto-refreshing data...');
      await loadDashboardData();
      await loadActionsData();
    }
  }, AUTO_REFRESH_INTERVAL_MS);
  
  console.log('[aethermsaid hub] Auto-refresh started (every ' + (AUTO_REFRESH_INTERVAL_MS / 1000) + ' seconds)');
}

/**
 * Stop auto-refresh interval
 */
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log('[aethermsaid hub] Auto-refresh stopped');
  }
}

/**
 * Play notification sound
 */
function playNotificationSound() {
  try {
    const audio = new Audio(api.runtime.getURL('sounds/notification.mp3'));
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {
    console.log('Sound not available');
  }
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  const aiNotifications = document.getElementById('ai-notifications');
  
  try {
    // Load emails
    const emailsRes = await api.runtime.sendMessage({ action: 'getEmails' });
    const emails = emailsRes.success ? (emailsRes.data || []) : [];
    unreadCount.textContent = emails.length;
    
    // Load events
    const eventsRes = await api.runtime.sendMessage({ action: 'getTodayEvents' });
    const events = eventsRes.success ? (eventsRes.data || []) : [];
    eventsCount.textContent = events.length;
    
    // Generate INSTANT insights from data (no AI wait)
    generateInstantInsights(aiNotifications, emails, events);
    
    // Play sound if there are important items
    if (emails.length > 0 || events.length > 0) {
      playNotificationSound();
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    unreadCount.textContent = '-';
    eventsCount.textContent = '-';
    if (aiNotifications) {
      aiNotifications.innerHTML = '<div class="empty-state">Failed to load insights</div>';
    }
  }
}

/**
 * Generate instant insights from data (no AI delay)
 */
function generateInstantInsights(container, emails, events) {
  if (!container) return;
  
  if (!isConnected) {
    container.innerHTML = '<div class="empty-state">Connect to see insights</div>';
    return;
  }
  
  const insights = [];
  
  // Email insights
  if (emails.length > 0) {
    const unreadEmails = emails.filter(e => !e.is_read);
    if (unreadEmails.length > 0) {
      insights.push({
        icon: '📧',
        text: `You have ${unreadEmails.length} unread email${unreadEmails.length > 1 ? 's' : ''} waiting`
      });
      
      // Most recent email
      const recent = unreadEmails[0];
      if (recent?.sender) {
        insights.push({
          icon: '📬',
          text: `Latest from ${recent.sender.split('<')[0].trim()}: "${(recent.subject || 'No subject').substring(0, 40)}..."`
        });
      }
    }
  }
  
  // Event insights
  if (events.length > 0) {
    insights.push({
      icon: '📅',
      text: `${events.length} event${events.length > 1 ? 's' : ''} scheduled for today`
    });
    
    // Next event
    const nextEvent = events[0];
    if (nextEvent?.title) {
      const time = nextEvent.start_time ? new Date(nextEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      insights.push({
        icon: '⏰',
        text: `Next: "${nextEvent.title.substring(0, 30)}" ${time ? 'at ' + time : ''}`
      });
    }
  }
  
  // Default insight if nothing
  if (insights.length === 0) {
    insights.push({
      icon: '✨',
      text: 'All caught up! No pending emails or events'
    });
  }
  
  // Render insights
  container.innerHTML = insights.slice(0, 5).map(insight => `
    <div class="notification-item">
      <div class="notification-icon">${insight.icon}</div>
      <div class="notification-text">${escapeHtml(insight.text)}</div>
    </div>
  `).join('');
}

/**
 * Generate AI insights from user data (optional, for deeper analysis)
 */
async function generateAIInsights(container) {
  if (!container) return;
  
  if (!isConnected) {
    container.innerHTML = '<div class="empty-state">Connect to see AI insights</div>';
    return;
  }
  
  container.innerHTML = '<div class="loading">✨ Generating insights...</div>';
  
  try {
    // Ask AI to generate insights based on current data
    const response = await api.runtime.sendMessage({
      action: 'askAI',
      message: 'Generate 3 brief, actionable notifications or insights for me based on my unread emails, upcoming events, and recent activity. Format each as a single short sentence with an emoji. Be specific and helpful.'
    });
    
    if (response.success && response.data) {
      const text = response.data.response || response.data.text || '';
      renderAINotifications(container, text);
    } else {
      container.innerHTML = '<div class="empty-state">Could not generate insights</div>';
    }
  } catch (error) {
    console.error('Failed to generate AI insights:', error);
    container.innerHTML = '<div class="empty-state">AI insights unavailable</div>';
  }
}

/**
 * Render AI notifications from text
 */
function renderAINotifications(container, text) {
  // Split by newlines and filter empty lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    container.innerHTML = '<div class="empty-state">No insights available</div>';
    return;
  }
  
  // Take up to 5 insights
  const insights = lines.slice(0, 5);
  
  container.innerHTML = insights.map((insight, idx) => {
    // Determine icon based on content
    let icon = '💡';
    const lower = insight.toLowerCase();
    if (lower.includes('email') || lower.includes('message')) icon = '📧';
    else if (lower.includes('meeting') || lower.includes('event') || lower.includes('calendar')) icon = '📅';
    else if (lower.includes('urgent') || lower.includes('important') || lower.includes('priority')) icon = '🔴';
    else if (lower.includes('reminder')) icon = '⏰';
    else if (lower.includes('task') || lower.includes('todo')) icon = '✅';
    
    return `
      <div class="notification-item">
        <div class="notification-icon">${icon}</div>
        <div class="notification-text markdown-content">${renderMarkdown(insight)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Load current page info
 */
async function loadCurrentPageInfo() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentPageData = {
        title: tab.title,
        url: tab.url
      };
      
      if (currentPageInfo) {
        currentPageInfo.innerHTML = `
          <div class="page-title">${escapeHtml(tab.title || 'Untitled')}</div>
          <div class="page-url">${escapeHtml(tab.url || '')}</div>
        `;
      }
    }
  } catch (error) {
    console.error('Failed to get current page:', error);
  }
}

/**
 * Save current page
 */
async function saveCurrentPage() {
  if (!isConnected) {
    showNotification('Please connect to aethermsaid hub first');
    return;
  }
  
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    // Get page content
    api.tabs.sendMessage(tab.id, { action: 'getPageContent' }, async (response) => {
      if (response) {
        try {
          const result = await api.runtime.sendMessage({
            action: 'saveCurrentPage',
            payload: {
              content: response.content,
              url: tab.url,
              title: tab.title
            }
          });
          
          if (result.success) {
            showNotification('Page saved to knowledge base!');
          } else {
            showNotification('Failed to save: ' + (result.error || 'Unknown error'));
          }
        } catch (error) {
          showNotification('Failed to save page');
        }
      } else {
        showNotification('Could not read page content');
      }
    });
  } catch (error) {
    showNotification('Failed to save page');
  }
}

/**
 * Handle save note
 */
async function handleSaveNote() {
  const note = noteTextarea.value.trim();
  if (!note) {
    showNotification('Please enter a note');
    return;
  }
  
  if (!isConnected) {
    showNotification('Please connect to aethermsaid hub first');
    return;
  }
  
  try {
    const result = await api.runtime.sendMessage({ action: 'quickNote', note });
    if (result.success) {
      noteTextarea.value = '';
      showNotification('Note saved!');
    } else {
      showNotification('Failed to save note');
    }
  } catch (error) {
    showNotification('Failed to save note');
  }
}

/**
 * Handle send chat message
 */
async function handleSendChat() {
  const message = chatInput.value.trim();
  if (!message) return;
  
  if (!isConnected) {
    showNotification('Please connect to aethermsaid hub first');
    return;
  }
  
  // Clear welcome message if present
  const welcome = chatMessages.querySelector('.chat-welcome');
  if (welcome) welcome.remove();
  
  // Add user message
  addChatMessage('user', message);
  chatInput.value = '';
  sendBtn.disabled = true;
  
  // Add thinking indicator
  const thinkingId = addChatMessage('thinking', 'Thinking...');
  
  await sendAIRequest(message, thinkingId);
}

/**
 * Send AI request
 */
async function sendAIRequest(message, thinkingId) {
  try {
    const response = await api.runtime.sendMessage({ action: 'askAI', message });
    
    // Remove thinking indicator
    if (thinkingId) {
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
    }
    
    if (response.success) {
      const text = response.data?.text || response.data?.response || 'No response';
      addChatMessage('ai', text);
    } else {
      addChatMessage('ai', 'Error: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    // Remove thinking indicator
    if (thinkingId) {
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) thinkingEl.remove();
    }
    addChatMessage('ai', 'Error: ' + error.message);
  }
  
  sendBtn.disabled = false;
}

/**
 * Add message to chat
 */
function addChatMessage(role, text) {
  const id = 'msg-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = `chat-message ${role}`;
  
  // Render markdown for AI messages, plain text for user
  if (role === 'ai') {
    div.innerHTML = `<div class="markdown-content">${renderMarkdown(text)}</div>`;
  } else {
    div.textContent = text;
  }
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

/**
 * Show notification
 */
function showNotification(message) {
  api.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'aethermsaid hub',
    message: message
  });
}

/**
 * Format time
 */
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
  return Math.floor(diff / 86400000) + 'd';
}

/**
 * Render markdown to sanitized HTML
 */
function renderMarkdown(text) {
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    try {
      const rawHtml = marked.parse(text);
      return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
      });
    } catch (e) {
      console.warn('Markdown rendering failed:', e);
      return escapeHtml(text);
    }
  }
  return escapeHtml(text);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load actions data for the Actions tab
 */
async function loadActionsData() {
  if (!isConnected) {
    if (actionsList) actionsList.innerHTML = '<div class="empty-state">Connect to see actions</div>';
    return;
  }
  
  const filterValue = actionsFilter?.value || 'pending';
  
  if (actionsList) {
    actionsList.innerHTML = '<div class="loading">Loading actions...</div>';
  }
  
  try {
    // Load stats
    const statsRes = await api.runtime.sendMessage({ action: 'getActionsStats' });
    if (statsRes.success && statsRes.data) {
      const stats = statsRes.data;
      if (pendingActionsCount) pendingActionsCount.textContent = stats.pending || 0;
      if (inProgressActionsCount) inProgressActionsCount.textContent = stats.in_progress || 0;
      if (completedActionsCount) completedActionsCount.textContent = stats.completed || 0;
    }
    
    // Load actions based on filter
    let actionsRes;
    if (filterValue === 'all') {
      actionsRes = await api.runtime.sendMessage({ action: 'getActions' });
    } else {
      actionsRes = await api.runtime.sendMessage({ action: 'getActionsByStatus', status: filterValue });
    }
    
    if (actionsRes.success) {
      const actions = actionsRes.data || [];
      renderActionsList(actions);
    } else {
      if (actionsList) actionsList.innerHTML = '<div class="empty-state">Failed to load actions</div>';
    }
  } catch (error) {
    console.error('Failed to load actions:', error);
    if (actionsList) actionsList.innerHTML = '<div class="empty-state">Error loading actions</div>';
  }
}

/**
 * Render actions list
 */
function renderActionsList(actions) {
  if (!actionsList) return;
  
  if (!actions || actions.length === 0) {
    actionsList.innerHTML = '<div class="empty-state">No actions found</div>';
    return;
  }
  
  actionsList.innerHTML = actions.slice(0, 20).map(action => {
    const statusIcon = getStatusIcon(action.status);
    const statusClass = getStatusClass(action.status);
    const platformIcon = getPlatformIcon(action.platform);
    const timeAgo = formatTime(action.created_at);
    
    return `
      <div class="action-item ${statusClass}" data-id="${action.id}">
        <div class="action-header">
          <span class="platform-icon">${platformIcon}</span>
          <span class="action-source">${escapeHtml(action.source_name || 'Unknown')}</span>
          <span class="action-time">${timeAgo}</span>
        </div>
        <div class="action-content">${escapeHtml(action.action_text || '')}</div>
        <div class="action-footer">
          <span class="action-status ${statusClass}">${statusIcon} ${action.status}</span>
          <div class="action-buttons">
            ${action.status === 'pending' ? `
              <button class="btn-mini btn-start" data-action="start" data-id="${action.id}" title="Start">▶</button>
              <button class="btn-mini btn-dismiss" data-action="dismiss" data-id="${action.id}" title="Dismiss">✕</button>
            ` : ''}
            ${action.status === 'in_progress' ? `
              <button class="btn-mini btn-complete" data-action="complete" data-id="${action.id}" title="Complete">✓</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers for action buttons
  actionsList.querySelectorAll('.btn-mini').forEach(btn => {
    btn.addEventListener('click', handleActionButton);
  });
}

/**
 * Handle action button click
 */
async function handleActionButton(e) {
  const btn = e.target;
  const actionType = btn.dataset.action;
  const actionId = btn.dataset.id;
  
  let newStatus;
  switch (actionType) {
    case 'start': newStatus = 'in_progress'; break;
    case 'complete': newStatus = 'completed'; break;
    case 'dismiss': newStatus = 'dismissed'; break;
    default: return;
  }
  
  try {
    const result = await api.runtime.sendMessage({ 
      action: 'updateActionStatus', 
      id: actionId, 
      status: newStatus 
    });
    
    if (result.success) {
      loadActionsData(); // Refresh the list
    } else {
      showNotification('Failed to update action');
    }
  } catch (error) {
    console.error('Failed to update action:', error);
    showNotification('Failed to update action');
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
  switch (status) {
    case 'pending': return '⏳';
    case 'in_progress': return '🔄';
    case 'completed': return '✅';
    case 'dismissed': return '❌';
    default: return '•';
  }
}

/**
 * Get status CSS class
 */
function getStatusClass(status) {
  switch (status) {
    case 'pending': return 'status-pending';
    case 'in_progress': return 'status-progress';
    case 'completed': return 'status-completed';
    case 'dismissed': return 'status-dismissed';
    default: return '';
  }
}

/**
 * Get platform icon
 */
function getPlatformIcon(platform) {
  switch (platform) {
    case 'discord': return '💬';
    case 'whatsapp': return '📱';
    case 'telegram': return '✈️';
    case 'email': return '📧';
    case 'github': return '🐙';
    default: return '📌';
  }
}

// Listen for connection state changes from background
api.runtime.onMessage.addListener((message) => {
  if (message.type === 'connection') {
    updateConnectionState(message.status === 'connected');
    if (message.status === 'connected') {
      loadDashboardData();
      loadActionsData();
    }
  }
});

// Initialize
init();
