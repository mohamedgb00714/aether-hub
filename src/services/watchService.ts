/**
 * Watch Service - Manages watched items across platforms
 * Provides a unified interface for watching emails, Discord channels/servers,
 * WhatsApp chats, Telegram channels, GitHub repos, etc.
 */

import type { WatchedItem, WatchPlatform, WatchItemType, ActionStatus } from '../types';

// Generate a unique ID
const generateId = (): string => {
  return `watch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Convert database item to typed WatchedItem
const dbToWatchedItem = (item: any): WatchedItem => ({
  id: item.id,
  platform: item.platform as WatchPlatform,
  itemType: item.item_type as WatchItemType,
  itemId: item.item_id,
  itemName: item.item_name,
  itemMetadata: item.item_metadata,
  action: item.action,
  actionStatus: item.action_status as ActionStatus,
  watchStatus: item.watch_status as 'active' | 'paused',
  notes: item.notes,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

// Get all watched items
export async function getAllWatchedItems(): Promise<WatchedItem[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) {
      console.error('Watch API not available');
      return [];
    }
    const items = await api.db.watchedItems.getAll();
    return items.map(dbToWatchedItem);
  } catch (error) {
    console.error('Failed to get watched items:', error);
    return [];
  }
}

// Get watched items by platform
export async function getWatchedItemsByPlatform(platform: WatchPlatform): Promise<WatchedItem[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return [];
    const items = await api.db.watchedItems.getByPlatform(platform);
    return items.map(dbToWatchedItem);
  } catch (error) {
    console.error('Failed to get watched items by platform:', error);
    return [];
  }
}

// Get watched items by action status
export async function getWatchedItemsByStatus(status: ActionStatus): Promise<WatchedItem[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return [];
    const items = await api.db.watchedItems.getByStatus(status);
    return items.map(dbToWatchedItem);
  } catch (error) {
    console.error('Failed to get watched items by status:', error);
    return [];
  }
}

// Get active watched items
export async function getActiveWatchedItems(): Promise<WatchedItem[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return [];
    const items = await api.db.watchedItems.getActive();
    return items.map(dbToWatchedItem);
  } catch (error) {
    console.error('Failed to get active watched items:', error);
    return [];
  }
}

// Get pending watched items (active with pending action)
export async function getPendingWatchedItems(): Promise<WatchedItem[]> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return [];
    const items = await api.db.watchedItems.getPending();
    return items.map(dbToWatchedItem);
  } catch (error) {
    console.error('Failed to get pending watched items:', error);
    return [];
  }
}

// Check if an item is watched
export async function isItemWatched(platform: WatchPlatform, itemType: WatchItemType, itemId: string): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    return await api.db.watchedItems.isWatched(platform, itemType, itemId);
  } catch (error) {
    console.error('Failed to check if item is watched:', error);
    return false;
  }
}

// Add an item to watch list
export async function addToWatchList(params: {
  platform: WatchPlatform;
  itemType: WatchItemType;
  itemId: string;
  itemName: string;
  itemMetadata?: Record<string, any>;
  action?: string;
  notes?: string;
}): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    
    const item = {
      id: generateId(),
      platform: params.platform,
      item_type: params.itemType,
      item_id: params.itemId,
      item_name: params.itemName,
      item_metadata: params.itemMetadata ? JSON.stringify(params.itemMetadata) : null,
      action: params.action || null,
      action_status: 'pending',
      watch_status: 'active',
      notes: params.notes || null,
    };
    
    return await api.db.watchedItems.create(item);
  } catch (error) {
    console.error('Failed to add to watch list:', error);
    return false;
  }
}

// Remove an item from watch list
export async function removeFromWatchList(id: string): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    return await api.db.watchedItems.delete(id);
  } catch (error) {
    console.error('Failed to remove from watch list:', error);
    return false;
  }
}

// Remove an item by its platform/type/id combo
export async function removeFromWatchListByItemId(platform: WatchPlatform, itemType: WatchItemType, itemId: string): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    return await api.db.watchedItems.deleteByItemId(platform, itemType, itemId);
  } catch (error) {
    console.error('Failed to remove from watch list by item ID:', error);
    return false;
  }
}

// Update watched item action status
export async function updateActionStatus(id: string, status: ActionStatus): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    return await api.db.watchedItems.updateStatus(id, status);
  } catch (error) {
    console.error('Failed to update action status:', error);
    return false;
  }
}

// Update watched item details
export async function updateWatchedItem(id: string, updates: {
  action?: string;
  notes?: string;
  actionStatus?: ActionStatus;
  watchStatus?: 'active' | 'paused';
}): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    
    const dbUpdates: any = {};
    if (updates.action !== undefined) dbUpdates.action = updates.action;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.actionStatus !== undefined) dbUpdates.action_status = updates.actionStatus;
    if (updates.watchStatus !== undefined) dbUpdates.watch_status = updates.watchStatus;
    
    return await api.db.watchedItems.update(id, dbUpdates);
  } catch (error) {
    console.error('Failed to update watched item:', error);
    return false;
  }
}

// Toggle watch status (active/paused)
export async function toggleWatchStatus(id: string): Promise<boolean> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return false;
    return await api.db.watchedItems.toggleWatch(id);
  } catch (error) {
    console.error('Failed to toggle watch status:', error);
    return false;
  }
}

// Mark action as completed
export async function markActionCompleted(id: string): Promise<boolean> {
  return updateActionStatus(id, 'completed');
}

// Mark action as in progress
export async function markActionInProgress(id: string): Promise<boolean> {
  return updateActionStatus(id, 'in_progress');
}

// Dismiss action
export async function dismissAction(id: string): Promise<boolean> {
  return updateActionStatus(id, 'dismissed');
}

// Clear all completed items
export async function clearCompletedItems(): Promise<number> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return 0;
    return await api.db.watchedItems.clearCompleted();
  } catch (error) {
    console.error('Failed to clear completed items:', error);
    return 0;
  }
}

// Clear all dismissed items
export async function clearDismissedItems(): Promise<number> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.db?.watchedItems) return 0;
    return await api.db.watchedItems.clearDismissed();
  } catch (error) {
    console.error('Failed to clear dismissed items:', error);
    return 0;
  }
}

// Helper to get platform icon name
export function getPlatformIcon(platform: WatchPlatform): string {
  switch (platform) {
    case 'email': return 'EnvelopeIcon';
    case 'discord': return 'ChatBubbleLeftRightIcon';
    case 'whatsapp': return 'ChatBubbleLeftRightIcon';
    case 'telegram': return 'PaperAirplaneIcon';
    case 'github': return 'CodeBracketIcon';
    case 'calendar': return 'CalendarDaysIcon';
    default: return 'EyeIcon';
  }
}

// Helper to get platform color
export function getPlatformColor(platform: WatchPlatform): string {
  switch (platform) {
    case 'email': return 'text-red-500 bg-red-50';
    case 'discord': return 'text-indigo-500 bg-indigo-50';
    case 'whatsapp': return 'text-green-500 bg-green-50';
    case 'telegram': return 'text-blue-500 bg-blue-50';
    case 'github': return 'text-slate-700 bg-slate-100';
    case 'calendar': return 'text-purple-500 bg-purple-50';
    default: return 'text-slate-500 bg-slate-50';
  }
}

// Helper to get action status color
export function getActionStatusColor(status: ActionStatus): string {
  switch (status) {
    case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'completed': return 'text-green-600 bg-green-50 border-green-200';
    case 'dismissed': return 'text-slate-400 bg-slate-50 border-slate-200';
    default: return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

// Helper to get action status label
export function getActionStatusLabel(status: ActionStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'dismissed': return 'Dismissed';
    default: return status;
  }
}

// Export the service
const watchService = {
  getAllWatchedItems,
  getWatchedItemsByPlatform,
  getWatchedItemsByStatus,
  getActiveWatchedItems,
  getPendingWatchedItems,
  isItemWatched,
  addToWatchList,
  removeFromWatchList,
  removeFromWatchListByItemId,
  updateActionStatus,
  updateWatchedItem,
  toggleWatchStatus,
  markActionCompleted,
  markActionInProgress,
  dismissAction,
  clearCompletedItems,
  clearDismissedItems,
  getPlatformIcon,
  getPlatformColor,
  getActionStatusColor,
  getActionStatusLabel,
};

export default watchService;
