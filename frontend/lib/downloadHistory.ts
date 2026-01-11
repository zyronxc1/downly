/**
 * Download history item stored in localStorage
 */
export interface DownloadHistoryItem {
  id: string;
  url: string;
  title: string;
  formatId: string;
  formatExt: string;
  resolution: string;
  filesize: string;
  downloadedAt: string;
  thumbnail?: string;
  platform?: string; // Platform name (e.g., 'YouTube', 'Instagram', 'TikTok')
  formatType?: 'video' | 'audio'; // Format type
}

const STORAGE_KEY = 'downly_download_history';
const MAX_HISTORY_ITEMS = 50; // Keep last 50 downloads in storage
const DISPLAY_HISTORY_ITEMS = 10; // Show last 10 items in UI

/**
 * Gets all download history items
 */
export function getDownloadHistory(): DownloadHistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const items = JSON.parse(stored) as DownloadHistoryItem[];
    // Sort by downloadedAt (newest first)
    return items.sort((a, b) => 
      new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
    );
  } catch (error) {
    console.error('Error reading download history:', error);
    return [];
  }
}

/**
 * Gets the last N download history items for display
 */
export function getRecentDownloadHistory(limit: number = DISPLAY_HISTORY_ITEMS): DownloadHistoryItem[] {
  return getDownloadHistory().slice(0, limit);
}

/**
 * Adds a download to history
 */
export function addToDownloadHistory(item: Omit<DownloadHistoryItem, 'id' | 'downloadedAt'>): void {
  try {
    const history = getDownloadHistory();
    
    // Create new item with ID and timestamp
    const newItem: DownloadHistoryItem = {
      ...item,
      id: `dl_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      downloadedAt: new Date().toISOString(),
    };
    
    // Add to beginning and limit to MAX_HISTORY_ITEMS
    const updated = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('downloadHistory:updated'));
    }
  } catch (error) {
    console.error('Error saving download history:', error);
  }
}

/**
 * Removes a download from history
 */
export function removeFromDownloadHistory(id: string): void {
  try {
    const history = getDownloadHistory();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Dispatch event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('downloadHistory:updated'));
    }
  } catch (error) {
    console.error('Error removing from download history:', error);
  }
}

/**
 * Clears all download history
 */
export function clearDownloadHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    
    // Dispatch event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('downloadHistory:updated'));
    }
  } catch (error) {
    console.error('Error clearing download history:', error);
  }
}

/**
 * Gets download history count
 */
export function getDownloadHistoryCount(): number {
  return getDownloadHistory().length;
}

