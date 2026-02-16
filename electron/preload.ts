import { contextBridge, ipcRenderer } from 'electron';

console.log('✅ Preload script loaded');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls - using send for fire-and-forget operations
  window: {
    minimize: () => {
      console.log('🔵 PRELOAD: minimize() called');
      ipcRenderer.send('window:minimize');
    },
    maximize: () => {
      console.log('🔵 PRELOAD: maximize() called');
      ipcRenderer.send('window:maximize');
    },
    close: () => {
      console.log('🔵 PRELOAD: close() called');
      ipcRenderer.send('window:close');
    },
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },
  
  // App info
  app: {
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  
  // Autostart settings
  autostart: {
    get: () => ipcRenderer.invoke('autostart:get'),
    set: (enabled: boolean) => ipcRenderer.invoke('autostart:set', enabled)
  },
  
  // Secure storage using electron-store
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear')
  },
  
  // File dialogs
  dialog: {
    openFile: (options: Electron.OpenDialogOptions) => 
      ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: Electron.SaveDialogOptions) => 
      ipcRenderer.invoke('dialog:saveFile', options)
  },
  
  // Notifications
  notification: {
    show: (options: { title: string; body: string }) => 
      ipcRenderer.invoke('notification:show', options)
  },
  
  // Clipboard
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
    readText: () => ipcRenderer.invoke('clipboard:readText')
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // Screenshot capture
  screenshot: {
    capture: () => ipcRenderer.invoke('screenshot:capture')
  },

  // Floating Microphone / Speech-to-Text
  mic: {
    onToggle: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('mic:toggle', handler);
      return () => ipcRenderer.removeListener('mic:toggle', handler);
    },
    onModeSwitch: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('mic:mode-switch', handler);
      return () => ipcRenderer.removeListener('mic:mode-switch', handler);
    },
    onPushToTalkStart: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('mic:push-to-talk-start', handler);
      return () => ipcRenderer.removeListener('mic:push-to-talk-start', handler);
    },
  },

  // System text input (for dictation)
  system: {
    pasteText: (text: string) => ipcRenderer.invoke('system:pasteText', text),
  },

  // Overlay window communication
  overlay: {
    updatePosition: (position: any) => ipcRenderer.invoke('overlay:updatePosition', position),
    toggle: () => ipcRenderer.invoke('overlay:toggle'),
    show: () => ipcRenderer.invoke('overlay:show'),
    hide: () => ipcRenderer.invoke('overlay:hide'),
    isVisible: () => ipcRenderer.invoke('overlay:isVisible'),
    resize: (width: number, height: number) => ipcRenderer.send('mic-overlay:resize', { width, height }),
    sendMessage: (message: any) => ipcRenderer.invoke('overlay:sendMessage', message),
    toMainWindow: (message: any) => ipcRenderer.invoke('overlay:toMainWindow', message),
    onMessage: (callback: (message: any) => void) => {
      const handler = (_event: any, message: any) => callback(message);
      ipcRenderer.on('overlay-message', handler);
      return () => ipcRenderer.removeListener('overlay-message', handler);
    },
    onSettingsChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('settings:changed', handler);
      return () => ipcRenderer.removeListener('settings:changed', handler);
    }
  },

  // Notes overlay window (floating notes over all windows)
  notesOverlay: {
    toggle: () => ipcRenderer.invoke('notes-overlay:toggle'),
    show: () => ipcRenderer.invoke('notes-overlay:show'),
    hide: () => ipcRenderer.invoke('notes-overlay:hide'),
    isVisible: () => ipcRenderer.invoke('notes-overlay:isVisible'),
    resize: (width: number, height: number) => ipcRenderer.send('notes-overlay:resize', { width, height }),
    updatePosition: (position: { x: number; y: number }) => ipcRenderer.invoke('notes-overlay:updatePosition', position),
    sendMessage: (message: any) => ipcRenderer.invoke('notes-overlay:sendMessage', message),
    toMainWindow: (message: any) => ipcRenderer.invoke('notes-overlay:toMainWindow', message),
    onMessage: (callback: (message: any) => void) => {
      const handler = (_event: any, message: any) => callback(message);
      ipcRenderer.on('notes-overlay-message', handler);
      return () => ipcRenderer.removeListener('notes-overlay-message', handler);
    },
    // Broadcast notes changes to all windows (for instant sync)
    broadcast: () => ipcRenderer.invoke('notes:broadcast'),
    // Listen for notes changes from any window
    onNotesChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('notes:changed', handler);
      return () => ipcRenderer.removeListener('notes:changed', handler);
    },
  },

  // Whisper.cpp STT (local/offline speech recognition)
  whisper: {
    checkInstalled: () => ipcRenderer.invoke('whisper:checkInstalled'),
    transcribe: (audioData: ArrayBuffer) => ipcRenderer.invoke('whisper:transcribe', audioData),
    getModels: () => ipcRenderer.invoke('whisper:getModels'),
    downloadModel: (modelName: string) => ipcRenderer.invoke('whisper:downloadModel', modelName),
  },
  
  // Browser addon management
  addon: {
    getSecret: () => ipcRenderer.invoke('addon:getSecret'),
    generateSecret: () => ipcRenderer.invoke('addon:generateSecret'),
    getConnectedClients: () => ipcRenderer.invoke('addon:getConnectedClients'),
    getConnectedCount: () => ipcRenderer.invoke('addon:getConnectedCount'),
    downloadExtension: (browser: 'chrome' | 'firefox') => ipcRenderer.invoke('addon:downloadExtension', browser),
    onConnected: (callback: (data: { clientId: string; browser: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('addon:connected', handler);
      return () => ipcRenderer.removeListener('addon:connected', handler);
    },
    onDisconnected: (callback: (data: { clientId: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('addon:disconnected', handler);
      return () => ipcRenderer.removeListener('addon:disconnected', handler);
    },
    onContentSaved: (callback: (data: { pageId: string; url: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('addon:content-saved', handler);
      return () => ipcRenderer.removeListener('addon:content-saved', handler);
    },
    onAIRequest: (callback: (data: { id: string; action: string; payload: any }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('addon:ai-request', handler);
      return () => ipcRenderer.removeListener('addon:ai-request', handler);
    },
    sendAIResponse: (response: { id: string; success: boolean; data?: any; error?: string }) => {
      ipcRenderer.send('addon:ai-response', response);
    }
  },
  
  // Auto-updater
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check')
  },
  
  // OAuth
  oauth: {
    openExternal: (url: string) => ipcRenderer.invoke('oauth:openExternal', url)
  },

  // Resend API (via main process to avoid CORS)
  resend: {
    validateApiKey: (apiKey: string) => ipcRenderer.invoke('resend:validateApiKey', apiKey),
    getDomains: (apiKey: string) => ipcRenderer.invoke('resend:getDomains', apiKey),
    getAudiences: (apiKey: string) => ipcRenderer.invoke('resend:getAudiences', apiKey),
    getContacts: (apiKey: string, audienceId: string) => ipcRenderer.invoke('resend:getContacts', apiKey, audienceId),
    sendEmail: (apiKey: string, emailData: any) => ipcRenderer.invoke('resend:sendEmail', apiKey, emailData),
    createAudience: (apiKey: string, name: string) => ipcRenderer.invoke('resend:createAudience', apiKey, name),
    addContact: (apiKey: string, audienceId: string, contact: any) => ipcRenderer.invoke('resend:addContact', apiKey, audienceId, contact),
    removeContact: (apiKey: string, audienceId: string, contactId: string) => ipcRenderer.invoke('resend:removeContact', apiKey, audienceId, contactId),
    getEmail: (apiKey: string, emailId: string) => ipcRenderer.invoke('resend:getEmail', apiKey, emailId),
    getReceivedEmails: (apiKey: string, limit?: number) => ipcRenderer.invoke('resend:getReceivedEmails', apiKey, limit),
    getSentEmails: (apiKey: string, limit?: number) => ipcRenderer.invoke('resend:getSentEmails', apiKey, limit)
  },



  // Database operations
  db: {
    cleanupLinkedIn: () => ipcRenderer.invoke('db:cleanupLinkedIn'),
    accounts: {
      getAll: () => ipcRenderer.invoke('db:accounts:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:accounts:getById', id),
      getByPlatform: (platform: string) => ipcRenderer.invoke('db:accounts:getByPlatform', platform),
      upsert: (account: any) => ipcRenderer.invoke('db:accounts:upsert', account),
      delete: (id: string) => ipcRenderer.invoke('db:accounts:delete', id),
      deleteNullIds: () => ipcRenderer.invoke('db:accounts:deleteNullIds'),
    },
    emails: {
      getAll: () => ipcRenderer.invoke('db:emails:getAll'),
      getByAccount: (accountId: string) => ipcRenderer.invoke('db:emails:getByAccount', accountId),
      getUnread: () => ipcRenderer.invoke('db:emails:getUnread'),
      getByTag: (tag: string) => ipcRenderer.invoke('db:emails:getByTag', tag),
      bulkUpsert: (emails: any[]) => ipcRenderer.invoke('db:emails:bulkUpsert', emails),
      update: (id: string, updates: any) => ipcRenderer.invoke('db:emails:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:emails:delete', id),
      clearByAccount: (accountId: string) => ipcRenderer.invoke('db:emails:clearByAccount', accountId),
    },
    events: {
      getAll: () => ipcRenderer.invoke('db:events:getAll'),
      getByAccount: (accountId: string) => ipcRenderer.invoke('db:events:getByAccount', accountId),
      getUpcoming: (limit?: number) => ipcRenderer.invoke('db:events:getUpcoming', limit),
      getByDateRange: (startDate: string, endDate: string) => 
        ipcRenderer.invoke('db:events:getByDateRange', startDate, endDate),
      bulkUpsert: (events: any[]) => ipcRenderer.invoke('db:events:bulkUpsert', events),
      update: (id: string, updates: any) => ipcRenderer.invoke('db:events:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:events:delete', id),
      clearByAccount: (accountId: string) => ipcRenderer.invoke('db:events:clearByAccount', accountId),
    },
    folders: {
      getAll: () => ipcRenderer.invoke('db:folders:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:folders:getById', id),
      create: (folder: any) => ipcRenderer.invoke('db:folders:create', folder),
      update: (id: string, updates: any) => ipcRenderer.invoke('db:folders:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:folders:delete', id),
    },
    notifications: {
      getAll: () => ipcRenderer.invoke('db:notifications:getAll'),
      getUnread: () => ipcRenderer.invoke('db:notifications:getUnread'),
      bulkUpsert: (notifications: any[]) => ipcRenderer.invoke('db:notifications:bulkUpsert', notifications),
      markAsRead: (id: string) => ipcRenderer.invoke('db:notifications:markAsRead', id),
      delete: (id: string) => ipcRenderer.invoke('db:notifications:delete', id),
    },
    github: {
      getAll: () => ipcRenderer.invoke('db:github:getAll'),
      getByAccount: (accountId: string) => ipcRenderer.invoke('db:github:getByAccount', accountId),
      getByType: (type: string) => ipcRenderer.invoke('db:github:getByType', type),
      bulkUpsert: (items: any[]) => ipcRenderer.invoke('db:github:bulkUpsert', items),
      markAsRead: (id: string) => ipcRenderer.invoke('db:github:markAsRead', id),
      delete: (id: string) => ipcRenderer.invoke('db:github:delete', id),
      clearByAccount: (accountId: string) => ipcRenderer.invoke('db:github:clearByAccount', accountId),
    },
    notes: {
      getAll: () => ipcRenderer.invoke('db:notes:getAll'),
      getById: (id: number) => ipcRenderer.invoke('db:notes:getById', id),
      getByCategory: (category: string) => ipcRenderer.invoke('db:notes:getByCategory', category),
      getPinned: () => ipcRenderer.invoke('db:notes:getPinned'),
      upsert: (note: any) => ipcRenderer.invoke('db:notes:upsert', note),
      delete: (id: number) => ipcRenderer.invoke('db:notes:delete', id),
    },
  },

  // Invoicing API
  invoicing: {
    // Clients
    getAllClients: () => ipcRenderer.invoke('invoicing:clients:getAll'),
    getClient: (id: string) => ipcRenderer.invoke('invoicing:clients:getById', id),
    searchClients: (query: string) => ipcRenderer.invoke('invoicing:clients:search', query),
    createClient: (client: any) => ipcRenderer.invoke('invoicing:clients:create', client),
    updateClient: (id: string, updates: any) => ipcRenderer.invoke('invoicing:clients:update', id, updates),
    deleteClient: (id: string) => ipcRenderer.invoke('invoicing:clients:delete', id),
    
    // Invoices
    getAllInvoices: () => ipcRenderer.invoke('invoicing:invoices:getAll'),
    getInvoice: (id: string) => ipcRenderer.invoke('invoicing:invoices:getById', id),
    getInvoicesByStatus: (status: string) => ipcRenderer.invoke('invoicing:invoices:getByStatus', status),
    getInvoicesByClient: (clientId: string) => ipcRenderer.invoke('invoicing:invoices:getByClient', clientId),
    getInvoicesByPaymentStatus: (paymentStatus: string) => 
      ipcRenderer.invoke('invoicing:invoices:getByPaymentStatus', paymentStatus),
    getOverdueInvoices: () => ipcRenderer.invoke('invoicing:invoices:getOverdue'),
    getInvoicesDueSoon: (days?: number) => ipcRenderer.invoke('invoicing:invoices:getDueSoon', days || 7),
    getInvoicesByDateRange: (startDate: string, endDate: string) => 
      ipcRenderer.invoke('invoicing:invoices:getByDateRange', startDate, endDate),
    getNextInvoiceNumber: () => ipcRenderer.invoke('invoicing:invoices:getNextNumber'),
    createInvoice: (invoice: any) => ipcRenderer.invoke('invoicing:invoices:create', invoice),
    updateInvoice: (id: string, updates: any) => ipcRenderer.invoke('invoicing:invoices:update', id, updates),
    updateInvoiceStatus: (id: string, status: string) => 
      ipcRenderer.invoke('invoicing:invoices:updateStatus', id, status),
    updateInvoicePayment: (id: string, paymentStatus: string, paidAmount: number) => 
      ipcRenderer.invoke('invoicing:invoices:updatePayment', id, paymentStatus, paidAmount),
    deleteInvoice: (id: string) => ipcRenderer.invoke('invoicing:invoices:delete', id),
    
    // Invoice Items
    getInvoiceItems: (invoiceId: string) => ipcRenderer.invoke('invoicing:items:getByInvoice', invoiceId),
    createInvoiceItem: (item: any) => ipcRenderer.invoke('invoicing:items:create', item),
    updateInvoiceItem: (id: string, updates: any) => ipcRenderer.invoke('invoicing:items:update', id, updates),
    deleteInvoiceItem: (id: string) => ipcRenderer.invoke('invoicing:items:delete', id),
    deleteInvoiceItemsByInvoice: (invoiceId: string) => 
      ipcRenderer.invoke('invoicing:items:deleteByInvoice', invoiceId),
    
    // Payments
    getAllPayments: () => ipcRenderer.invoke('invoicing:payments:getAll'),
    getPaymentsByInvoice: (invoiceId: string) => ipcRenderer.invoke('invoicing:payments:getByInvoice', invoiceId),
    getPaymentsByDateRange: (startDate: string, endDate: string) => 
      ipcRenderer.invoke('invoicing:payments:getByDateRange', startDate, endDate),
    getTotalPaymentsByInvoice: (invoiceId: string) => 
      ipcRenderer.invoke('invoicing:payments:getTotalByInvoice', invoiceId),
    createPayment: (payment: any) => ipcRenderer.invoke('invoicing:payments:create', payment),
    deletePayment: (id: string) => ipcRenderer.invoke('invoicing:payments:delete', id),
    
    // Taxes
    getAllTaxes: () => ipcRenderer.invoke('invoicing:taxes:getAll'),
    getTax: (id: string) => ipcRenderer.invoke('invoicing:taxes:getById', id),
    getDefaultTax: () => ipcRenderer.invoke('invoicing:taxes:getDefault'),
    createTax: (tax: any) => ipcRenderer.invoke('invoicing:taxes:create', tax),
    updateTax: (id: string, updates: any) => ipcRenderer.invoke('invoicing:taxes:update', id, updates),
    deleteTax: (id: string) => ipcRenderer.invoke('invoicing:taxes:delete', id),
    
    // Recurring Invoices
    getAllRecurringInvoices: () => ipcRenderer.invoke('invoicing:recurring:getAll'),
    getRecurringInvoice: (id: string) => ipcRenderer.invoke('invoicing:recurring:getById', id),
    getActiveRecurringInvoices: () => ipcRenderer.invoke('invoicing:recurring:getActive'),
    getRecurringInvoicesDueToday: () => ipcRenderer.invoke('invoicing:recurring:getDueToday'),
    createRecurringInvoice: (profile: any) => ipcRenderer.invoke('invoicing:recurring:create', profile),
    updateRecurringInvoice: (id: string, updates: any) => 
      ipcRenderer.invoke('invoicing:recurring:update', id, updates),
    updateRecurringInvoiceNextDate: (id: string, nextIssueDate: string) => 
      ipcRenderer.invoke('invoicing:recurring:updateNextDate', id, nextIssueDate),
    deleteRecurringInvoice: (id: string) => ipcRenderer.invoke('invoicing:recurring:delete', id),
    
    // Invoice Settings
    getInvoiceSettings: () => ipcRenderer.invoke('invoicing:settings:get'),
    updateInvoiceSettings: (settings: any) => ipcRenderer.invoke('invoicing:settings:update', settings),
  },

  // Event listeners for main process messages
  on: {
    navigate: (callback: (path: string) => void) => {
      const handler = (_event: any, path: string) => callback(path);
      ipcRenderer.on('navigate', handler);
      return () => ipcRenderer.removeListener('navigate', handler);
    },
    triggerSearch: (callback: () => void) => {
      ipcRenderer.on('trigger-search', () => callback());
    },
    oauthCallback: (callback: (url: string) => void) => {
      ipcRenderer.on('oauth-callback', (_event, url) => callback(url));
    },
    // WhatsApp events
    whatsappQR: (callback: (qr: string) => void) => {
      ipcRenderer.on('whatsapp:qr', (_event, qr) => callback(qr));
    },
    whatsappReady: (callback: () => void) => {
      ipcRenderer.on('whatsapp:ready', () => callback());
    },
    whatsappDisconnected: (callback: (reason: string) => void) => {
      ipcRenderer.on('whatsapp:disconnected', (_event, reason) => callback(reason));
    },
    whatsappAuthFailure: (callback: (error: string) => void) => {
      ipcRenderer.on('whatsapp:authFailure', (_event, error) => callback(error));
    },
    whatsappMessage: (callback: (message: any) => void) => {
      ipcRenderer.on('whatsapp:message', (_event, message) => callback(message));
    },
    // Telegram events
    telegramReady: (callback: () => void) => {
      ipcRenderer.on('telegram:ready', () => callback());
    },
    telegramDisconnected: (callback: (reason: string) => void) => {
      ipcRenderer.on('telegram:disconnected', (_event, reason) => callback(reason));
    },
    telegramAuthFailure: (callback: (error: string) => void) => {
      ipcRenderer.on('telegram:authFailure', (_event, error) => callback(error));
    },
    telegramMessage: (callback: (message: any) => void) => {
      ipcRenderer.on('telegram:message', (_event, message) => callback(message));
    },
    telegramPhoneNeeded: (callback: () => void) => {
      ipcRenderer.on('telegram:phoneNeeded', () => callback());
    },
    telegramCodeNeeded: (callback: () => void) => {
      ipcRenderer.on('telegram:codeNeeded', () => callback());
    },
    telegramPasswordNeeded: (callback: () => void) => {
      ipcRenderer.on('telegram:passwordNeeded', () => callback());
    },
    // Discord events
    discordReady: (callback: () => void) => {
      ipcRenderer.on('discord-selfbot:ready', () => callback());
    },
    discordDisconnected: (callback: () => void) => {
      ipcRenderer.on('discord-selfbot:disconnected', () => callback());
    },
    discordMessage: (callback: (message: any) => void) => {
      ipcRenderer.on('discord-selfbot:message', (_event, message) => callback(message));
    },
    discordError: (callback: (data: { error: string }) => void) => {
      ipcRenderer.on('discord-selfbot:error', (_event, data) => callback(data));
    }
  },
  
  // Remove listeners
  removeListener: {
    navigate: () => ipcRenderer.removeAllListeners('navigate'),
    triggerSearch: () => ipcRenderer.removeAllListeners('trigger-search'),
    oauthCallback: () => ipcRenderer.removeAllListeners('oauth-callback'),
    whatsappQR: () => ipcRenderer.removeAllListeners('whatsapp:qr'),
    whatsappReady: () => ipcRenderer.removeAllListeners('whatsapp:ready'),
    whatsappDisconnected: () => ipcRenderer.removeAllListeners('whatsapp:disconnected'),
    whatsappAuthFailure: () => ipcRenderer.removeAllListeners('whatsapp:authFailure'),
    whatsappMessage: () => ipcRenderer.removeAllListeners('whatsapp:message'),
    telegramReady: () => ipcRenderer.removeAllListeners('telegram:ready'),
    telegramDisconnected: () => ipcRenderer.removeAllListeners('telegram:disconnected'),
    telegramAuthFailure: () => ipcRenderer.removeAllListeners('telegram:authFailure'),
    telegramMessage: () => ipcRenderer.removeAllListeners('telegram:message'),
    telegramPhoneNeeded: () => ipcRenderer.removeAllListeners('telegram:phoneNeeded'),
    telegramCodeNeeded: () => ipcRenderer.removeAllListeners('telegram:codeNeeded'),
    telegramPasswordNeeded: () => ipcRenderer.removeAllListeners('telegram:passwordNeeded'),
    discordReady: () => ipcRenderer.removeAllListeners('discord-selfbot:ready'),
    discordDisconnected: () => ipcRenderer.removeAllListeners('discord-selfbot:disconnected'),
    discordMessage: () => ipcRenderer.removeAllListeners('discord-selfbot:message'),
    discordError: () => ipcRenderer.removeAllListeners('discord-selfbot:error')
  },

  // WhatsApp operations
  whatsapp: {
    initialize: () => ipcRenderer.invoke('whatsapp:initialize'),
    isReady: () => ipcRenderer.invoke('whatsapp:isReady'),
    hasSession: () => ipcRenderer.invoke('whatsapp:hasSession'),
    getAuthState: () => ipcRenderer.invoke('whatsapp:getAuthState'),
    getQRCode: () => ipcRenderer.invoke('whatsapp:getQRCode'),
    logout: () => ipcRenderer.invoke('whatsapp:logout'),
    getInfo: () => ipcRenderer.invoke('whatsapp:getInfo'),
    getChats: (limit?: number) => ipcRenderer.invoke('whatsapp:getChats', limit),
    getChatMessages: (chatId: string, limit?: number) => 
      ipcRenderer.invoke('whatsapp:getChatMessages', chatId, limit),
    getRecentMessages: (limit?: number) => ipcRenderer.invoke('whatsapp:getRecentMessages', limit),
    getContacts: () => ipcRenderer.invoke('whatsapp:getContacts'),
    sendMessage: (chatId: string, message: string) => 
      ipcRenderer.invoke('whatsapp:sendMessage', chatId, message),
    sendMedia: (chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string, sendAsVoice?: boolean) =>
      ipcRenderer.invoke('whatsapp:sendMedia', chatId, mediaBase64, mimetype, filename, caption, sendAsVoice),
    markAsRead: (chatId: string) => ipcRenderer.invoke('whatsapp:markAsRead', chatId),
    // Database operations
    db: {
      getAccounts: () => ipcRenderer.invoke('whatsapp:db:getAccounts'),
      getConnectedAccount: () => ipcRenderer.invoke('whatsapp:db:getConnectedAccount'),
      updateAISettings: (accountId: string, aiSettings: string) => 
        ipcRenderer.invoke('whatsapp:db:updateAISettings', accountId, aiSettings),
      getAISettings: (accountId: string) => ipcRenderer.invoke('whatsapp:db:getAISettings', accountId),
      getChats: (accountId: string) => ipcRenderer.invoke('whatsapp:db:getChats', accountId),
      getMessages: (chatId: string, limit?: number) => ipcRenderer.invoke('whatsapp:db:getMessages', chatId, limit),
      getRecentMessages: (accountId: string, limit?: number) => ipcRenderer.invoke('whatsapp:db:getRecentMessages', accountId, limit)
    }
  },

  // Telegram operations
  telegram: {
    initialize: () => ipcRenderer.invoke('telegram:initialize'),
    isReady: () => ipcRenderer.invoke('telegram:isReady'),
    hasSession: () => ipcRenderer.invoke('telegram:hasSession'),
    hasApiCredentials: () => ipcRenderer.invoke('telegram:hasApiCredentials'),
    setApiCredentials: (apiId: number, apiHash: string) => ipcRenderer.invoke('telegram:setApiCredentials', apiId, apiHash),
    getAuthState: () => ipcRenderer.invoke('telegram:getAuthState'),
    submitPhoneNumber: (phone: string) => ipcRenderer.invoke('telegram:submitPhoneNumber', phone),
    submitCode: (code: string) => ipcRenderer.invoke('telegram:submitCode', code),
    submitPassword: (password: string) => ipcRenderer.invoke('telegram:submitPassword', password),
    logout: () => ipcRenderer.invoke('telegram:logout'),
    getInfo: () => ipcRenderer.invoke('telegram:getInfo'),
    getChats: (limit?: number) => ipcRenderer.invoke('telegram:getChats', limit),
    getChatMessages: (chatId: string, limit?: number) => 
      ipcRenderer.invoke('telegram:getChatMessages', chatId, limit),
    getRecentMessages: (limit?: number) => ipcRenderer.invoke('telegram:getRecentMessages', limit),
    getContacts: () => ipcRenderer.invoke('telegram:getContacts'),
    sendMessage: (chatId: string, message: string) => 
      ipcRenderer.invoke('telegram:sendMessage', chatId, message),
    sendMedia: (chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string) =>
      ipcRenderer.invoke('telegram:sendMedia', chatId, mediaBase64, mimetype, filename, caption),
    markAsRead: (chatId: string) => ipcRenderer.invoke('telegram:markAsRead', chatId),
    // Database operations
    db: {
      getAccounts: () => ipcRenderer.invoke('telegram:db:getAccounts'),
      getConnectedAccount: () => ipcRenderer.invoke('telegram:db:getConnectedAccount'),
      updateAISettings: (accountId: string, aiSettings: string) => 
        ipcRenderer.invoke('telegram:db:updateAISettings', accountId, aiSettings),
      getAISettings: (accountId: string) => ipcRenderer.invoke('telegram:db:getAISettings', accountId),
      getChats: (accountId: string) => ipcRenderer.invoke('telegram:db:getChats', accountId),
      getMessages: (chatId: string, limit?: number) => ipcRenderer.invoke('telegram:db:getMessages', chatId, limit),
      getRecentMessages: (accountId: string, limit?: number) => ipcRenderer.invoke('telegram:db:getRecentMessages', accountId, limit)
    }
  },

  // YouTube operations
  youtube: {
    extractChannelId: (url: string) => ipcRenderer.invoke('youtube:extractChannelId', url),
    fetchChannelFeed: (channelId: string) => ipcRenderer.invoke('youtube:fetchChannelFeed', channelId),
    getVideoTranscript: (videoId: string) => ipcRenderer.invoke('youtube:getVideoTranscript', videoId),
    syncAllChannels: () => ipcRenderer.invoke('youtube:syncAllChannels'),
    buildRssUrl: (channelId: string) => ipcRenderer.invoke('youtube:buildRssUrl', channelId),
  },

  // Chrome profile detection for browser automation
  chrome: {
    getProfiles: () => ipcRenderer.invoke('chrome:getProfiles'),
    getExecutablePath: () => ipcRenderer.invoke('chrome:getExecutablePath'),
    isInstalled: () => ipcRenderer.invoke('chrome:isInstalled'),
  },

  // Python and browser-use management
  python: {
    checkInstalled: () => ipcRenderer.invoke('python:checkInstalled'),
  },
  uv: {
    checkInstalled: () => ipcRenderer.invoke('uv:checkInstalled'),
    install: () => ipcRenderer.invoke('uv:install'),
  },
  browseruse: {
    checkInstalled: () => ipcRenderer.invoke('browseruse:checkInstalled'),
    install: () => ipcRenderer.invoke('browseruse:install'),
    execute: (config: any) => ipcRenderer.invoke('browseruse:execute', config),
    onInstallProgress: (callback: (message: string) => void) => {
      const handler = (_event: any, message: string) => callback(message);
      ipcRenderer.on('browseruse:install-progress', handler);
      return () => ipcRenderer.removeListener('browseruse:install-progress', handler);
    },
  },

  // Automation management
  automation: {
    create: (automation: any) => ipcRenderer.invoke('automation:create', automation),
    getAll: () => ipcRenderer.invoke('automation:getAll'),
    get: (id: string) => ipcRenderer.invoke('automation:get', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('automation:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('automation:delete', id),
    execute: (automationId: string, config: any) => ipcRenderer.invoke('automation:execute', automationId, config),
    stop: (automationId: string) => ipcRenderer.invoke('automation:stop', automationId),
    isRunning: (automationId: string) => ipcRenderer.invoke('automation:isRunning', automationId),
    getSchedulerStatus: () => ipcRenderer.invoke('automation:getSchedulerStatus'),
    setMaxConcurrent: (max: number) => ipcRenderer.invoke('automation:setMaxConcurrent', max),
    reloadSchedules: () => ipcRenderer.invoke('automation:reloadSchedules'),
    createHistory: (history: any) => ipcRenderer.invoke('automation:createHistory', history),
    getHistory: (automationId: string) => ipcRenderer.invoke('automation:getHistory', automationId),
    updateHistory: (id: string, updates: any) => ipcRenderer.invoke('automation:updateHistory', id, updates),
    analyzeResult: (result: string, task: string) => ipcRenderer.invoke('automation:analyzeResult', result, task),
  },

  // Discord Selfbot operations (Read-Only)
  // ⚠️ WARNING: Self-bot usage violates Discord TOS
  discordSelfBot: {
    initialize: (token: string) => ipcRenderer.invoke('discord-selfbot:initialize', token),
    isReady: () => ipcRenderer.invoke('discord-selfbot:isReady'),
    isEnabled: () => ipcRenderer.invoke('discord-selfbot:isEnabled'),
    getSavedToken: () => ipcRenderer.invoke('discord-selfbot:getSavedToken'),
    getAuthState: () => ipcRenderer.invoke('discord-selfbot:getAuthState'),
    getUserInfo: () => ipcRenderer.invoke('discord-selfbot:getUserInfo'),
    disconnect: () => ipcRenderer.invoke('discord-selfbot:disconnect'),
    getGuilds: () => ipcRenderer.invoke('discord-selfbot:getGuilds'),
    getDMChannels: () => ipcRenderer.invoke('discord-selfbot:getDMChannels'),
    getThreads: (channelId: string) => ipcRenderer.invoke('discord-selfbot:getThreads', channelId),
    fetchMessages: (channelId: string, limit?: number, before?: string) => 
      ipcRenderer.invoke('discord-selfbot:fetchMessages', channelId, limit, before),
    syncAll: () => ipcRenderer.invoke('discord-selfbot:syncAll'),
    autoConnect: () => ipcRenderer.invoke('discord-selfbot:autoConnect'),
    // Event listeners
    onReady: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discord-selfbot:ready', (_event, data) => callback(data));
    },
    onMessage: (callback: (message: unknown) => void) => {
      ipcRenderer.on('discord-selfbot:message', (_event, message) => callback(message));
    },
    onDisconnected: (callback: () => void) => {
      ipcRenderer.on('discord-selfbot:disconnected', () => callback());
    },
    onError: (callback: (error: unknown) => void) => {
      ipcRenderer.on('discord-selfbot:error', (_event, error) => callback(error));
    },
    onSyncComplete: (callback: (data: unknown) => void) => {
      ipcRenderer.on('discord-selfbot:sync-complete', (_event, data) => callback(data));
    },
    // Remove listeners
    removeListeners: () => {
      ipcRenderer.removeAllListeners('discord-selfbot:ready');
      ipcRenderer.removeAllListeners('discord-selfbot:message');
      ipcRenderer.removeAllListeners('discord-selfbot:disconnected');
      ipcRenderer.removeAllListeners('discord-selfbot:error');
      ipcRenderer.removeAllListeners('discord-selfbot:sync-complete');
    }
  },

  // GitHub Copilot SDK
  copilot: {
    createSession: (options: any) => ipcRenderer.invoke('copilot:createSession', options),
    sendRequest: (sessionId: string, prompt: string, options?: any) => ipcRenderer.invoke('copilot:sendRequest', sessionId, prompt, options),
    stopSession: (sessionId: string) => ipcRenderer.invoke('copilot:stopSession', sessionId),
    listSessions: () => ipcRenderer.invoke('copilot:listSessions'),
    getMessages: (sessionId: string) => ipcRenderer.invoke('copilot:getMessages', sessionId),
    listModels: () => ipcRenderer.invoke('copilot:listModels'),
    getAuthStatus: () => ipcRenderer.invoke('copilot:getAuthStatus'),
    signIn: () => ipcRenderer.invoke('copilot:signIn'),
    initiateOAuthFlow: () => ipcRenderer.invoke('copilot:initiateOAuthFlow'),
    onAuthStatus: (callback: (data: { status: string, code?: string, message?: string }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('copilot:auth-status', handler);
      return () => ipcRenderer.removeListener('copilot:auth-status', handler);
    },
    onUpdate: (callback: (data: { sessionId: string, chunk: string }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('copilot:update', handler);
      return () => ipcRenderer.removeListener('copilot:update', handler);
    },
    onToolEvent: (callback: (data: { sessionId: string, type: string, data: any }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('copilot:toolEvent', handler);
      return () => ipcRenderer.removeListener('copilot:toolEvent', handler);
    }
  }
});

// Type safety for TypeScript
export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  app: {
    getPlatform: () => Promise<NodeJS.Platform>;
    getVersion: () => Promise<string>;
  };
  autostart: {
    get: () => Promise<boolean>;
    set: (enabled: boolean) => Promise<boolean>;
  };
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  dialog: {
    openFile: (options: Electron.OpenDialogOptions) => Promise<string[]>;
    saveFile: (options: Electron.SaveDialogOptions) => Promise<string | undefined>;
  };
  notification: {
    show: (options: { title: string; body: string }) => Promise<boolean>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };
  mic: {
    onToggle: (callback: () => void) => () => void;
    onModeSwitch: (callback: () => void) => () => void;
    onPushToTalkStart: (callback: () => void) => () => void;
  };
  system: {
    pasteText: (text: string) => Promise<{ success: boolean; text: string }>;
  };
  whisper: {
    checkInstalled: () => Promise<{
      installed: boolean;
      whisperPath: string | null;
      modelPath: string | null;
      hasFfmpeg: boolean;
      modelsDir: string;
      installInstructions: string | null;
    }>;
    transcribe: (audioData: ArrayBuffer) => Promise<{ transcript: string; confidence: number }>;
    getModels: () => Promise<Array<{
      name: string;
      size: string;
      url: string;
      installed: boolean;
      path: string | null;
    }>>;
    downloadModel: (modelName: string) => Promise<{ success: boolean; path: string }>;
  };
  addon: {
    getSecret: () => Promise<string | null>;
    generateSecret: () => Promise<string>;
    getConnectedClients: () => Promise<{ id: string; browser: string; connectedAt: string }[]>;
    getConnectedCount: () => Promise<number>;
    downloadExtension: (browser: 'chrome' | 'firefox') => Promise<{ success: boolean; path?: string; error?: string }>;
    onConnected: (callback: (data: { clientId: string; browser: string }) => void) => () => void;
    onDisconnected: (callback: (data: { clientId: string }) => void) => () => void;
    onContentSaved: (callback: (data: { pageId: string; url: string }) => void) => () => void;
    onAIRequest: (callback: (data: { id: string; action: string; payload: any }) => void) => () => void;
    sendAIResponse: (response: { id: string; success: boolean; data?: any; error?: string }) => void;
  };
  updater: {
    checkForUpdates: () => Promise<void>;
  };
  oauth: {
    openExternal: (url: string) => Promise<boolean>;
  };
  chrome: {
    getProfiles: () => Promise<Array<{
      id: string;
      name: string;
      path: string;
      email?: string;
      avatar?: string;
    }>>;
    getExecutablePath: () => Promise<string | null>;
    isInstalled: () => Promise<boolean>;
  };
  python: {
    checkInstalled: () => Promise<{ installed: boolean; version: string | null; command?: string }>;
  };
  uv: {
    checkInstalled: () => Promise<{ installed: boolean; version: string | null }>;
    install: () => Promise<{ success: boolean; error?: string }>;
  };
  browseruse: {
    checkInstalled: () => Promise<{ installed: boolean; version: string | null }>;
    install: () => Promise<{ success: boolean; error?: string }>;
    execute: (config: any) => Promise<{ success: boolean; output?: string; error?: string; task?: string }>;
    onInstallProgress: (callback: (message: string) => void) => () => void;
  };
  automation: {
    create: (automation: any) => Promise<{ success: boolean; id?: string; error?: string }>;
    getAll: () => Promise<{ success: boolean; automations?: any[]; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; automation?: any; error?: string }>;
    update: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    execute: (automationId: string, config: any) => Promise<{ success: boolean; output?: string; error?: string; queued?: boolean }>;
    stop: (automationId: string) => Promise<{ success: boolean; error?: string }>;
    isRunning: (automationId: string) => Promise<{ success: boolean; isRunning?: boolean; error?: string }>;
    getSchedulerStatus: () => Promise<{ success: boolean; maxConcurrent?: number; runningCount?: number; error?: string }>;
    setMaxConcurrent: (max: number) => Promise<{ success: boolean; error?: string }>;
    reloadSchedules: () => Promise<{ success: boolean; error?: string }>;
    createHistory: (history: any) => Promise<{ success: boolean; id?: string; error?: string }>;
    getHistory: (automationId: string) => Promise<{ success: boolean; history?: any[]; error?: string }>;
    updateHistory: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    analyzeResult: (result: string, task: string) => Promise<{ success: boolean; analysis?: string; error?: string }>;
  };

  db: {
    cleanupLinkedIn: () => Promise<{ success: boolean; message: string; deleteCounts: any }>;
    accounts: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      getByPlatform: (platform: string) => Promise<any[]>;
      upsert: (account: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      deleteNullIds: () => Promise<number>;
    };
    emails: {
      getAll: () => Promise<any[]>;
      getByAccount: (accountId: string) => Promise<any[]>;
      getUnread: () => Promise<any[]>;
      getByTag: (tag: string) => Promise<any[]>;
      bulkUpsert: (emails: any[]) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      clearByAccount: (accountId: string) => Promise<boolean>;
    };
    events: {
      getAll: () => Promise<any[]>;
      getByAccount: (accountId: string) => Promise<any[]>;
      getUpcoming: (limit?: number) => Promise<any[]>;
      getByDateRange: (startDate: string, endDate: string) => Promise<any[]>;
      bulkUpsert: (events: any[]) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      clearByAccount: (accountId: string) => Promise<boolean>;
    };
    folders: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (folder: any) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    notifications: {
      getAll: () => Promise<any[]>;
      getUnread: () => Promise<any[]>;
      bulkUpsert: (notifications: any[]) => Promise<boolean>;
      markAsRead: (id: string) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    github: {
      getAll: () => Promise<any[]>;
      getByAccount: (accountId: string) => Promise<any[]>;
      getByType: (type: string) => Promise<any[]>;
      bulkUpsert: (items: any[]) => Promise<boolean>;
      markAsRead: (id: string) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      clearByAccount: (accountId: string) => Promise<boolean>;
    };
    notes: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      getByCategory: (category: string) => Promise<any[]>;
      getPinned: () => Promise<any[]>;
      upsert: (note: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
    };
  };
  invoicing: {
    // Clients
    getAllClients: () => Promise<any[]>;
    getClient: (id: string) => Promise<any>;
    searchClients: (query: string) => Promise<any[]>;
    createClient: (client: any) => Promise<boolean>;
    updateClient: (id: string, updates: any) => Promise<boolean>;
    deleteClient: (id: string) => Promise<boolean>;
    
    // Invoices
    getAllInvoices: () => Promise<any[]>;
    getInvoice: (id: string) => Promise<any>;
    getInvoicesByStatus: (status: string) => Promise<any[]>;
    getInvoicesByClient: (clientId: string) => Promise<any[]>;
    getInvoicesByPaymentStatus: (paymentStatus: string) => Promise<any[]>;
    getOverdueInvoices: () => Promise<any[]>;
    getInvoicesDueSoon: (days?: number) => Promise<any[]>;
    getInvoicesByDateRange: (startDate: string, endDate: string) => Promise<any[]>;
    getNextInvoiceNumber: () => Promise<string>;
    createInvoice: (invoice: any) => Promise<boolean>;
    updateInvoice: (id: string, updates: any) => Promise<boolean>;
    updateInvoiceStatus: (id: string, status: string) => Promise<boolean>;
    updateInvoicePayment: (id: string, paymentStatus: string, paidAmount: number) => Promise<boolean>;
    deleteInvoice: (id: string) => Promise<boolean>;
    
    // Invoice Items
    getInvoiceItems: (invoiceId: string) => Promise<any[]>;
    createInvoiceItem: (item: any) => Promise<boolean>;
    updateInvoiceItem: (id: string, updates: any) => Promise<boolean>;
    deleteInvoiceItem: (id: string) => Promise<boolean>;
    deleteInvoiceItemsByInvoice: (invoiceId: string) => Promise<boolean>;
    
    // Payments
    getAllPayments: () => Promise<any[]>;
    getPaymentsByInvoice: (invoiceId: string) => Promise<any[]>;
    getPaymentsByDateRange: (startDate: string, endDate: string) => Promise<any[]>;
    getTotalPaymentsByInvoice: (invoiceId: string) => Promise<number>;
    createPayment: (payment: any) => Promise<boolean>;
    deletePayment: (id: string) => Promise<boolean>;
    
    // Taxes
    getAllTaxes: () => Promise<any[]>;
    getTax: (id: string) => Promise<any>;
    getDefaultTax: () => Promise<any>;
    createTax: (tax: any) => Promise<boolean>;
    updateTax: (id: string, updates: any) => Promise<boolean>;
    deleteTax: (id: string) => Promise<boolean>;
    
    // Recurring Invoices
    getAllRecurringInvoices: () => Promise<any[]>;
    getRecurringInvoice: (id: string) => Promise<any>;
    getActiveRecurringInvoices: () => Promise<any[]>;
    getRecurringInvoicesDueToday: () => Promise<any[]>;
    createRecurringInvoice: (profile: any) => Promise<boolean>;
    updateRecurringInvoice: (id: string, updates: any) => Promise<boolean>;
    updateRecurringInvoiceNextDate: (id: string, nextIssueDate: string) => Promise<boolean>;
    deleteRecurringInvoice: (id: string) => Promise<boolean>;
    
    // Invoice Settings
    getInvoiceSettings: () => Promise<any>;
    updateInvoiceSettings: (settings: any) => Promise<boolean>;
    
    // Reports & Analytics
    getDashboardStats: () => Promise<any>;
    getRevenueByPeriod: (startDate: string, endDate: string) => Promise<any[]>;
    getTaxSummary: (startDate: string, endDate: string) => Promise<any[]>;
    getClientRevenue: (clientId: string) => Promise<any>;
  };
  on: {
    navigate: (callback: (path: string) => void) => void;
    triggerSearch: (callback: () => void) => void;
    oauthCallback: (callback: (url: string) => void) => void;
    whatsappQR: (callback: (qr: string) => void) => void;
    whatsappReady: (callback: () => void) => void;
    whatsappDisconnected: (callback: (reason: string) => void) => void;
    whatsappAuthFailure: (callback: (error: string) => void) => void;
    whatsappMessage: (callback: (message: any) => void) => void;
    telegramMessage: (callback: (message: any) => void) => void;
    discordMessage: (callback: (message: any) => void) => void;
    discordReady: (callback: () => void) => void;
    discordDisconnected: (callback: () => void) => void;
  };
  removeListener: {
    navigate: () => void;
    triggerSearch: () => void;
    oauthCallback: () => void;
    whatsappQR: () => void;
    whatsappReady: () => void;
    whatsappDisconnected: () => void;
    whatsappAuthFailure: () => void;
    whatsappMessage: () => void;
    telegramMessage: () => void;
    discordMessage: () => void;
    discordReady: () => void;
    discordDisconnected: () => void;
  };
  whatsapp: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    isReady: () => Promise<boolean>;
    hasSession: () => Promise<boolean>;
    getAuthState: () => Promise<{ state: string; qrCode: string | null; error: string | null }>;
    getQRCode: () => Promise<string | null>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    getInfo: () => Promise<{ name: string; number: string; platform: string; wid?: string; pushname?: string; me?: any } | null>;
    getChats: (limit?: number) => Promise<any[]>;
    getChatMessages: (chatId: string, limit?: number) => Promise<any[]>;
    getRecentMessages: (limit?: number) => Promise<any[]>;
    getContacts: () => Promise<any[]>;
    sendMessage: (chatId: string, message: string) => Promise<boolean>;
    sendMedia: (chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string, sendAsVoice?: boolean) => Promise<boolean>;
    markAsRead: (chatId: string) => Promise<{ success: boolean }>;
    db: {
      getAccounts: () => Promise<any[]>;
      getConnectedAccount: () => Promise<any | undefined>;
      updateAISettings: (accountId: string, aiSettings: string) => Promise<boolean>;
      getAISettings: (accountId: string) => Promise<any | null>;
      getChats: (accountId: string) => Promise<any[]>;
      getMessages: (chatId: string, limit?: number) => Promise<any[]>;
      getRecentMessages: (accountId: string, limit?: number) => Promise<any[]>;
    };
  };
  copilot: {
    createSession: (options: any) => Promise<string>;
    sendRequest: (sessionId: string, prompt: string) => Promise<any>;
    stopSession: (sessionId: string) => Promise<void>;
    listSessions: () => Promise<any[]>;
    getMessages: (sessionId: string) => Promise<any[]>;
    listModels: () => Promise<any[]>;
    getAuthStatus: () => Promise<{ authenticated: boolean; state: string; error?: string; user?: any }>;
    signIn: () => Promise<void>;
    initiateOAuthFlow: () => Promise<{ success: boolean; url: string }>;
    onAuthStatus: (callback: (data: { status: string, code?: string, message?: string }) => void) => () => void;
    onUpdate: (callback: (data: { sessionId: string, chunk: string }) => void) => () => void;
    onToolEvent: (callback: (data: { sessionId: string, type: string, data: any }) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
