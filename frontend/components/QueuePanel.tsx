'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueueJob, JobStatus, getQueueState, cancelJob, getJob } from '@/lib/api';
import { ProgressBar, ProgressData } from './ProgressBar';
import { useDownloadProgress } from '@/lib/useDownloadProgress';

interface QueuePanelProps {
  className?: string;
}

/**
 * Gets status badge styling
 */
function getStatusBadge(status: JobStatus): {
  color: string;
  bgColor: string;
  label: string;
  icon: JSX.Element;
} {
  switch (status) {
    case 'queued':
      return {
        color: 'text-gray-700 dark:text-gray-300',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        label: 'Queued',
        icon: (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case 'downloading':
      return {
        color: 'text-primary-700 dark:text-primary-300',
        bgColor: 'bg-primary-100 dark:bg-primary-900/30',
        label: 'Downloading',
        icon: (
          <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ),
      };
    case 'converting':
      return {
        color: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        label: 'Converting',
        icon: (
          <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      };
    case 'completed':
      return {
        color: 'text-success-700 dark:text-success-300',
        bgColor: 'bg-success-100 dark:bg-success-900/30',
        label: 'Completed',
        icon: (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      };
    case 'failed':
      return {
        color: 'text-error-700 dark:text-error-300',
        bgColor: 'bg-error-100 dark:bg-error-900/30',
        label: 'Failed',
        icon: (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
      };
  }
}

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Queue Item Component
 */
function QueueItem({
  job,
  onCancel,
  onRemove,
}: {
  job: QueueJob;
  onCancel: (jobId: string) => void;
  onRemove: (jobId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusBadge = getStatusBadge(job.status);
  const isActive = job.status === 'downloading' || job.status === 'converting';
  const canCancel = isActive || job.status === 'queued';
  const canRemove = job.status === 'completed' || job.status === 'failed';

  // Convert job to progress data format
  const progressData: ProgressData | null = job.downloadId && job.progress
    ? {
        downloadId: job.downloadId,
        bytesDownloaded: job.progress.bytesDownloaded,
        totalBytes: job.progress.totalBytes,
        percentage: job.progress.percentage,
        status: job.status === 'downloading' ? 'downloading' : 
                job.status === 'converting' ? 'downloading' : 
                job.status === 'completed' ? 'completed' : 
                job.status === 'failed' ? 'error' : 'downloading',
        error: job.error,
      }
    : null;

  // Get download progress if available (only for active downloads with downloadId)
  const { progress: realTimeProgress, speed } = useDownloadProgress({
    downloadId: job.downloadId || null,
    enabled: isActive && !!job.downloadId && job.type === 'download',
  });

  // Use real-time progress if available, otherwise use job progress
  const displayProgress = realTimeProgress || progressData;
  const displaySpeed = speed;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${statusBadge.bgColor} ${statusBadge.color}`}>
                {statusBadge.icon}
                {statusBadge.label}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {job.type === 'download' ? 'Download' : 'Convert'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {job.url}
            </p>
            {job.formatId && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Format: {job.formatId}
              </p>
            )}
            {job.targetFormat && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Target: {job.targetFormat.toUpperCase()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canCancel && (
              <button
                onClick={() => onCancel(job.id)}
                className="p-1.5 text-gray-400 hover:text-error-600 dark:hover:text-error-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 rounded"
                aria-label="Cancel job"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {canRemove && (
              <button
                onClick={() => onRemove(job.id)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 rounded"
                aria-label="Remove job"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            {(job.status === 'completed' || job.status === 'failed') && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 rounded"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isActive && displayProgress && (
          <div className="mb-3">
            <ProgressBar
              progress={displayProgress}
              speed={displaySpeed}
              onCancel={canCancel ? () => onCancel(job.id) : undefined}
            />
          </div>
        )}

        {/* Static Progress for completed/failed */}
        {!isActive && displayProgress && (
          <div className="mb-3">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  job.status === 'completed'
                    ? 'bg-success-500'
                    : job.status === 'failed'
                    ? 'bg-error-500'
                    : 'bg-gray-400'
                } transition-all duration-300`}
                style={{ width: `${displayProgress.percentage || 0}%` }}
              />
            </div>
            {displayProgress.percentage !== null && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {Math.round(displayProgress.percentage)}% complete
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.error && (
          <div className="mt-2 p-2 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-xs text-error-700 dark:text-error-300">
            {job.error}
          </div>
        )}

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Job ID:</span>
                  <span className="font-mono">{job.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{new Date(job.createdAt).toLocaleString()}</span>
                </div>
                {job.startedAt && (
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span>{new Date(job.startedAt).toLocaleString()}</span>
                  </div>
                )}
                {job.completedAt && (
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span>{new Date(job.completedAt).toLocaleString()}</span>
                  </div>
                )}
                {displayProgress && displayProgress.totalBytes && (
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span>{formatBytes(displayProgress.totalBytes)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/**
 * Queue Panel Component
 * 🟢 PULL ONLY ON CHANGE: Fetches queue after enqueue, completion, and cancel
 */
export function QueuePanel({ className = '' }: QueuePanelProps) {
  const [queueState, setQueueState] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch queue state
  const fetchQueueState = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const state = await getQueueState();
      setQueueState(state);
    } catch (err: any) {
      console.error('Error fetching queue state:', err);
      setError(err.message || 'Failed to load queue');
    } finally {
      setIsLoading(false);
    }
  };

  // 🟢 PULL ONLY ON CHANGE: Fetch on mount and listen for queue change events
  useEffect(() => {
    // Guard against build-time execution (static export)
    if (typeof window === 'undefined') return;
    if (!process.env.NEXT_PUBLIC_API_URL) return;

    // Initial fetch
    fetchQueueState();

    // Listen for queue change events (enqueue, complete, cancel)
    const handleQueueChange = () => {
      fetchQueueState();
    };

    window.addEventListener('queue:refresh', handleQueueChange);

    return () => {
      window.removeEventListener('queue:refresh', handleQueueChange);
    };
  }, []);

  // Handle cancel
  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      await fetchQueueState(); // Refresh state
    } catch (err: any) {
      console.error('Error cancelling job:', err);
      setError(err.message || 'Failed to cancel job');
    }
  };

  // Handle remove (for completed/failed jobs)
  const handleRemove = async (jobId: string) => {
    try {
      // For now, we'll just cancel it (backend will handle cleanup)
      // In a real implementation, you might want a separate remove endpoint
      await cancelJob(jobId);
      await fetchQueueState(); // Refresh state
    } catch (err: any) {
      console.error('Error removing job:', err);
      setError(err.message || 'Failed to remove job');
    }
  };

  // Filter jobs to show (exclude very old completed/failed jobs)
  const activeJobs = queueState?.jobs.filter((job: QueueJob) => {
    if (job.status === 'completed' || job.status === 'failed') {
      const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
      const age = Date.now() - completedAt;
      return age < 5 * 60 * 1000; // Show completed/failed jobs for 5 minutes
    }
    return true;
  }) || [];

  const hasJobs = activeJobs.length > 0;
  const queuedCount = queueState?.queuedCount || 0;
  const processingCount = queueState?.processingCount || 0;

  return (
    <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-primary-600 hover:bg-primary-700'
            : 'bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600'
        } text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
        aria-label={isOpen ? 'Close queue' : 'Open queue'}
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
        {(queuedCount > 0 || processingCount > 0) && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-error-500 text-xs font-bold text-white">
            {queuedCount + processingCount}
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
            className="absolute bottom-16 sm:bottom-20 right-0 w-[calc(100vw-2rem)] sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[70vh] sm:max-h-[600px] flex flex-col"
          >
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  Download Queue
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
              {queueState && (
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span>
                    {processingCount} processing
                  </span>
                  <span>
                    {queuedCount} queued
                  </span>
                  <span>
                    {queueState.completedCount} completed
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {isLoading && !queueState && (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded text-sm text-error-700 dark:text-error-300">
                  {error}
                </div>
              )}

              {!hasJobs && !isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Queue is empty
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Downloads and conversions will appear here
                  </p>
                </div>
              )}

              {hasJobs && (
                <div className="space-y-3">
                  <AnimatePresence>
                    {activeJobs.map((job: QueueJob) => (
                      <QueueItem
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
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

