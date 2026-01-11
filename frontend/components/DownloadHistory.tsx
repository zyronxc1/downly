'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DownloadHistoryItem, getRecentDownloadHistory, removeFromDownloadHistory, clearDownloadHistory, getDownloadHistory } from '@/lib/downloadHistory';
import { getDownloadUrl, API_BASE_URL } from '@/lib/api';
import { getPlatformInfo } from '@/lib/platformUtils';

interface DownloadHistoryProps {
  className?: string;
  onDownload?: (url: string, formatId: string) => void;
}

/**
 * Formats date to relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  // For older items, show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Download History Item Component
 */
function HistoryItem({
  item,
  onDownload,
  onRemove,
}: {
  item: DownloadHistoryItem;
  onDownload: (url: string, formatId: string) => void;
  onRemove: (id: string) => void;
}) {
  const handleRedownload = () => {
    onDownload(item.url, item.formatId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        {item.thumbnail && (
          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={`${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(item.thumbnail)}`}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide image on error
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">
              {item.title}
            </h4>
            {/* Platform Icon */}
            {item.platform && (() => {
              const platformInfo = getPlatformInfo(item.url);
              return (
                <div className="flex-shrink-0" title={item.platform}>
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-700">
                    <svg
                      className={`w-4 h-4 ${platformInfo.color}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label={item.platform}
                    >
                      <path d={platformInfo.icon} />
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {item.formatExt.toUpperCase()}
            </span>
            {/* Format Type Badge */}
            {item.formatType && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                item.formatType === 'video'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
              }`}>
                {item.formatType === 'video' ? (
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
                {item.formatType}
              </span>
            )}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {item.resolution}
            </span>
            {item.filesize !== 'unknown' && (
              <span className="text-xs text-gray-600 dark:text-gray-400">
                • {item.filesize}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {formatRelativeTime(item.downloadedAt)}
          </p>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRedownload}
              className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download again
              </span>
            </button>
            <button
              onClick={() => onRemove(item.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-error-600 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
              aria-label="Remove from history"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Download History Component
 */
export function DownloadHistory({ className = '', onDownload }: DownloadHistoryProps) {
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isClient, setIsClient] = useState(false);

  // Mark as client-side rendered to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load history (only last 10 items for display)
  useEffect(() => {
    // Guard against build-time execution (static export)
    if (typeof window === 'undefined') return;

    const loadHistory = () => {
      const recent = getRecentDownloadHistory(10);
      const total = getDownloadHistory().length;
      setHistory(recent);
      setTotalCount(total);
    };
    
    loadHistory();
    
    // Listen for storage changes (from other tabs/windows)
    window.addEventListener('storage', loadHistory);
    
    // Also listen to custom events for same-tab updates
    const handleStorageUpdate = () => loadHistory();
    window.addEventListener('downloadHistory:updated', handleStorageUpdate);
    
    return () => {
      window.removeEventListener('storage', loadHistory);
      window.removeEventListener('downloadHistory:updated', handleStorageUpdate);
    };
  }, []);

  const handleRemove = (id: string) => {
    removeFromDownloadHistory(id);
    setHistory(getRecentDownloadHistory(10));
    // Dispatch event for same-tab updates
    window.dispatchEvent(new Event('downloadHistory:updated'));
  };

  const handleClear = () => {
    if (showClearConfirm) {
      clearDownloadHistory();
      setHistory([]);
      setShowClearConfirm(false);
      // Dispatch event for same-tab updates
      window.dispatchEvent(new Event('downloadHistory:updated'));
    } else {
      setShowClearConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  const handleRedownload = (url: string, formatId: string) => {
    if (onDownload) {
      onDownload(url, formatId);
    } else {
      // Fallback: open download URL directly
      const downloadUrl = getDownloadUrl(url, formatId);
      window.open(downloadUrl, '_blank');
    }
    setIsOpen(false);
  };

  const hasHistory = history.length > 0;

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-primary-600 hover:bg-primary-700'
            : 'bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600'
        } text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
        aria-label={isOpen ? 'Close history' : 'Open download history'}
      >
        <svg
          className={`absolute inset-0 m-auto h-6 w-6 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {isClient && totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-0 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[600px] flex flex-col"
          >
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Download History
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {history.length} {history.length === 1 ? 'item' : 'items'} (last 10)
                </p>
                {hasHistory && (
                  <button
                    onClick={handleClear}
                    className={`text-xs font-medium transition-colors duration-200 ${
                      showClearConfirm
                        ? 'text-error-600 dark:text-error-400 hover:text-error-700 dark:hover:text-error-500'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {showClearConfirm ? 'Click again to confirm' : 'Clear all'}
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {!hasHistory && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    No download history
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your completed downloads will appear here
                  </p>
                </div>
              )}

              {hasHistory && (
                <div className="space-y-3">
                  <AnimatePresence>
                    {history.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        onDownload={handleRedownload}
                        onRemove={handleRemove}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

