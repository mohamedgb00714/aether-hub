/**
 * Type declarations for Electron API exposed via preload
 * This file provides type safety for window.electronAPI in the renderer process
 */

export interface WhisperAPI {
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
}

export interface ElectronAPI {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
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
    openFile: (options: any) => Promise<string[]>;
    saveFile: (options: any) => Promise<string | undefined>;
  };
  notification: {
    show: (options: { title: string; body: string }) => Promise<boolean>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };
  shell: {
    openExternal: (url: string) => Promise<boolean>;
  };
  mic: {
    onToggle: (callback: () => void) => () => void;
    onModeSwitch: (callback: () => void) => () => void;
    onPushToTalkStart: (callback: () => void) => () => void;
  };
  system: {
    pasteText: (text: string) => Promise<{ success: boolean; text: string }>;
  };
  overlay: {
    updatePosition: (position: any) => Promise<void>;
    toggle: () => Promise<boolean>;
    show: () => Promise<void>;
    hide: () => Promise<void>;
    isVisible: () => Promise<boolean>;
    resize: (width: number, height: number) => void;
    sendMessage: (message: any) => Promise<void>;
    toMainWindow: (message: any) => Promise<boolean>;
    onMessage: (callback: (message: any) => void) => () => void;
    onSettingsChanged: (callback: () => void) => () => void;
  };
  whisper: WhisperAPI;
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
  copilot: {
    createSession: (options: {
      projectPath: string;
      agentType: string;
      tools: string[];
      model?: string;
      systemPrompt?: string;
    }) => Promise<string>;
    sendRequest: (sessionId: string, prompt: string, options?: {
      projectPath: string;
      agentType: string;
      tools: string[];
      model?: string;
      systemPrompt?: string;
    }) => Promise<any>;
    stopSession: (sessionId: string) => Promise<void>;
    listSessions: () => Promise<any[]>;
    getAuthStatus: () => Promise<{ authenticated: boolean; state: string; error?: string; user?: any }>;
    signIn: () => Promise<void>;
    initiateOAuthFlow: () => Promise<{ success: boolean; url: string }>;
    onAuthStatus: (callback: (data: { status: string, code?: string, message?: string }) => void) => () => void;
    onUpdate: (callback: (data: { sessionId: string, chunk: string }) => void) => () => void;
    onToolEvent: (callback: (data: { sessionId: string, type: string, data: any }) => void) => () => void;
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
    chatSessions: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (session: any) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    chatMessages: {
      getBySession: (sessionId: string) => Promise<any[]>;
      create: (message: any) => Promise<boolean>;
      deleteBySession: (sessionId: string) => Promise<boolean>;
    };
    knowledgeMessages: {
      getAll: () => Promise<any[]>;
      create: (message: any) => Promise<boolean>;
      deleteAll: () => Promise<boolean>;
    };
    knowledgeInsights: {
      getAll: () => Promise<any[]>;
      create: (insight: any) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      deleteAll: () => Promise<boolean>;
    };
    userActivities: {
      getAll: (limit?: number) => Promise<any[]>;
      getByPlatform: (platform: string, limit?: number) => Promise<any[]>;
      getByDateRange: (startDate: string, endDate: string) => Promise<any[]>;
      getByActionType: (actionType: string, limit?: number) => Promise<any[]>;
      insert: (activity: any) => Promise<boolean>;
      deleteOlderThan: (days: number) => Promise<boolean>;
    };
    knowledgeContext: {
      getAll: () => Promise<any[]>;
      getByCategory: (category: string) => Promise<any[]>;
      get: (category: string, key: string) => Promise<any>;
      upsert: (context: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    conversationSummaries: {
      getAll: (limit?: number) => Promise<any[]>;
      getByPlatform: (platform: string, limit?: number) => Promise<any[]>;
      get: (platform: string, threadId: string) => Promise<any>;
      upsert: (summary: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    whatsapp: {
      getChats: (accountId: string) => Promise<any[]>;
      getMessages: (chatId: string, limit?: number) => Promise<any[]>;
      getRecentMessages: (accountId: string, limit?: number) => Promise<any[]>;
      getAccounts: () => Promise<any[]>;
    };
    discord: {
      getGuilds: (accountId: string) => Promise<any[]>;
      getMessages: (channelId: string, limit?: number) => Promise<any[]>;
      getRecentMessages: (accountId: string, limit?: number) => Promise<any[]>;
    };
    watchedItems: {
      getAll: () => Promise<any[]>;
      getByPlatform: (platform: string) => Promise<any[]>;
      getByStatus: (actionStatus: string) => Promise<any[]>;
      getActive: () => Promise<any[]>;
      getPending: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      getByItemId: (platform: string, itemType: string, itemId: string) => Promise<any>;
      isWatched: (platform: string, itemType: string, itemId: string) => Promise<boolean>;
      create: (item: any) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      updateStatus: (id: string, actionStatus: string) => Promise<boolean>;
      toggleWatch: (id: string) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      deleteByItemId: (platform: string, itemType: string, itemId: string) => Promise<boolean>;
      clearCompleted: () => Promise<boolean>;
      clearDismissed: () => Promise<boolean>;
    };
    watchActions: {
      getAll: () => Promise<any[]>;
      getByStatus: (status: string) => Promise<any[]>;
      getByWatchedItem: (watchedItemId: string) => Promise<any[]>;
      create: (action: any) => Promise<boolean>;
      updateStatus: (id: string, status: string) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      clearCompleted: () => Promise<boolean>;
      clearDismissed: () => Promise<boolean>;
    };
    analyzedMessages: {
      isAnalyzed: (watchedItemId: string, messageId: string) => Promise<boolean>;
      markAsAnalyzed: (watchedItemId: string, messageIds: string[], platform: string) => Promise<boolean>;
      getAnalyzedIds: (watchedItemId: string) => Promise<string[]>;
      clearByWatchedItem: (watchedItemId: string) => Promise<boolean>;
    };
    resendTemplates: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (template: any) => Promise<boolean>;
      update: (id: string, updates: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
    };
    resendSentEmails: {
      getAll: (limit?: number) => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (email: any) => Promise<boolean>;
      updateEvent: (id: string, lastEvent: string, clicks?: number, opens?: number) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      deleteAll: () => Promise<boolean>;
    };
    intelligenceFeeds: {
      getAll: () => Promise<any[]>;
      getRecent: (limit: number) => Promise<any[]>;
      getByCategory: (category: string) => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (feed: any) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      deleteOlderThan: (days: number) => Promise<boolean>;
    };
    cleanup: {
      clearEmailContent: () => Promise<boolean>;
      clearWhatsAppMessages: () => Promise<boolean>;
      clearDiscordMessages: () => Promise<boolean>;
      clearAllChatMessages: () => Promise<boolean>;
      clearKnowledgeMessages: () => Promise<boolean>;
      clearKnowledgeInsights: () => Promise<boolean>;
      clearConversationSummaries: () => Promise<boolean>;
      clearAllSensitiveContent: () => Promise<boolean>;
      deleteAccountData: (accountId: string) => Promise<boolean>;
      vacuum: () => Promise<boolean>;
      getStats: () => Promise<any>;
    };
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
    telegramReady: (callback: () => void) => void;
    telegramDisconnected: (callback: (reason: string) => void) => void;
    telegramAuthFailure: (callback: (error: string) => void) => void;
    telegramMessage: (callback: (message: any) => void) => void;
    telegramPhoneNeeded: (callback: () => void) => void;
    telegramCodeNeeded: (callback: () => void) => void;
    telegramPasswordNeeded: (callback: () => void) => void;
    discordReady: (callback: () => void) => void;
    discordDisconnected: (callback: () => void) => void;
    discordMessage: (callback: (message: any) => void) => void;
    discordError: (callback: (data: { error: string }) => void) => void;
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
    telegramReady: () => void;
    telegramDisconnected: () => void;
    telegramAuthFailure: () => void;
    telegramMessage: () => void;
    telegramPhoneNeeded: () => void;
    telegramCodeNeeded: () => void;
    telegramPasswordNeeded: () => void;
    discordReady: () => void;
    discordDisconnected: () => void;
    discordMessage: () => void;
    discordError: () => void;
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
  telegram: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    isReady: () => Promise<boolean>;
    hasSession: () => Promise<boolean>;
    hasApiCredentials: () => Promise<boolean>;
    setApiCredentials: (apiId: number, apiHash: string) => Promise<boolean>;
    getAuthState: () => Promise<{ state: string; error: string | null }>;
    submitPhoneNumber: (phone: string) => Promise<boolean>;
    submitCode: (code: string) => Promise<boolean>;
    submitPassword: (password: string) => Promise<boolean>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    getInfo: () => Promise<any | null>;
    getChats: (limit?: number) => Promise<any[]>;
    getChatMessages: (chatId: string, limit?: number) => Promise<any[]>;
    getRecentMessages: (limit?: number) => Promise<any[]>;
    getContacts: () => Promise<any[]>;
    sendMessage: (chatId: string, message: string) => Promise<boolean>;
    sendMedia: (chatId: string, mediaBase64: string, mimetype: string, filename?: string, caption?: string) => Promise<boolean>;
    markAsRead: (chatId: string) => Promise<boolean>;
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
  discordSelfBot: {
    initialize: (token: string) => Promise<{ success: boolean; error?: string }>;
    isReady: () => Promise<boolean>;
    isEnabled: () => Promise<boolean>;
    getSavedToken: () => Promise<string | null>;
    getAuthState: () => Promise<{ state: string }>;
    getUserInfo: () => Promise<any | null>;
    disconnect: () => Promise<{ success: boolean }>;
    getGuilds: () => Promise<any[]>;
    getDMChannels: () => Promise<any[]>;
    getThreads: (channelId: string) => Promise<any[]>;
    fetchMessages: (channelId: string, limit?: number, before?: string) => Promise<any[]>;
    syncAll: () => Promise<{ success: boolean }>;
    autoConnect: () => Promise<{ success: boolean }>;
    onReady: (callback: (data: unknown) => void) => void;
    onMessage: (callback: (message: unknown) => void) => void;
    onDisconnected: (callback: () => void) => void;
    onError: (callback: (error: unknown) => void) => void;
    onSyncComplete: (callback: (data: unknown) => void) => void;
    removeListeners: () => void;
  };
  resend: {
    validateApiKey: (apiKey: string) => Promise<boolean>;
    getDomains: (apiKey: string) => Promise<any[]>;
    getAudiences: (apiKey: string) => Promise<any[]>;
    getContacts: (apiKey: string, audienceId: string) => Promise<any[]>;
    sendEmail: (apiKey: string, emailData: any) => Promise<any>;
    createAudience: (apiKey: string, name: string) => Promise<any>;
    addContact: (apiKey: string, audienceId: string, contact: any) => Promise<any>;
    removeContact: (apiKey: string, audienceId: string, contactId: string) => Promise<boolean>;
    getEmail: (apiKey: string, emailId: string) => Promise<any>;
    getReceivedEmails: (apiKey: string, limit?: number) => Promise<any[]>;
    getSentEmails: (apiKey: string, limit?: number) => Promise<any[]>;
  };
  chrome: {
    getProfiles: () => Promise<Array<{ name: string; path: string }>>;
    getExecutablePath: () => Promise<string | null>;
    isInstalled: () => Promise<boolean>;
  };
  python: {
    checkInstalled: () => Promise<{ installed: boolean; version: string | null }>;
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
  agent: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any | null>;
    create: (config: any) => Promise<any>;
    update: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    start: (id: string) => Promise<{ success: boolean; error?: string }>;
    stop: (id: string) => Promise<{ success: boolean; error?: string }>;
    runTask: (id: string, task: string) => Promise<{ success: boolean; result?: any; error?: string }>;
    generateAuthCode: (agentId: string) => Promise<{ success: boolean; code?: string; error?: string }>;
    getAuthorizedChatIds: (id: string) => Promise<string[]>;
    onStatus: (callback: (summary: any) => void) => () => void;
  };
  agentEvents: {
    publish: (event: any) => void;
  };
  agentTasks: {
    getAll: (agentId?: string) => Promise<any[]>;
    create: (task: any) => Promise<{ success: boolean; id?: string; error?: string }>;
    update: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    runNow: (id: string) => Promise<{ success: boolean; error?: string }>;
    getHistory: (taskId: string) => Promise<any[]>;
    createHistory: (history: any) => Promise<{ success: boolean; id?: string; error?: string }>;
    updateHistory: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    reloadSchedules: () => Promise<{ success: boolean; error?: string }>;
  };
  agentMemories: {
    getAll: (agentId: string) => Promise<any[]>;
    create: (memory: any) => Promise<{ success: boolean; id?: string; error?: string }>;
    update: (id: string, updates: any) => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
