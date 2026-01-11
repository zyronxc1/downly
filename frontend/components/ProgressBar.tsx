'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

export interface ProgressData {
  downloadId: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  percentage: number | null;
  status: 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

interface ProgressBarProps {
  progress: ProgressData;
  speed: number; // MB/s
  onCancel?: () => void;
  className?: string;
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
 * Calculates and formats estimated time remaining (ETA)
 */
function calculateETA(
  bytesDownloaded: number,
  totalBytes: number | null,
  speed: number // MB/s
): string | null {
  // Can't calculate ETA without total bytes or speed
  if (!totalBytes || speed <= 0 || bytesDownloaded >= totalBytes) {
    return null;
  }

  const remainingBytes = totalBytes - bytesDownloaded;
  const remainingMB = remainingBytes / (1024 * 1024);
  const secondsRemaining = remainingMB / speed;

  if (secondsRemaining < 0 || !isFinite(secondsRemaining)) {
    return null;
  }

  return formatTime(secondsRemaining);
}

/**
 * Formats seconds into human-readable time string
 * Examples: 45 -> "45s", 125 -> "2m 5s", 3665 -> "1h 1m"
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (secs > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${minutes}m`;
}

/**
 * Gets status text based on progress state
 */
function getStatusText(progress: ProgressData): string {
  switch (progress.status) {
    case 'downloading':
      return 'Downloading...';
    case 'completed':
      return 'Download completed!';
    case 'error':
      return progress.error || 'Download failed';
    case 'cancelled':
      return 'Download cancelled';
    default:
      return 'Preparing download...';
  }
}

/**
 * Gets status color based on progress state
 */
function getStatusColor(status: ProgressData['status']): string {
  switch (status) {
    case 'downloading':
      return 'text-primary-600 dark:text-primary-400';
    case 'completed':
      return 'text-success-600 dark:text-success-400';
    case 'error':
      return 'text-error-600 dark:text-error-400';
    case 'cancelled':
      return 'text-gray-600 dark:text-gray-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Gets progress bar color based on status
 */
function getProgressBarColor(status: ProgressData['status']): string {
  switch (status) {
    case 'downloading':
      return 'bg-gradient-to-r from-primary-500 to-primary-600';
    case 'completed':
      return 'bg-gradient-to-r from-success-500 to-success-600';
    case 'error':
      return 'bg-gradient-to-r from-error-500 to-error-600';
    case 'cancelled':
      return 'bg-gradient-to-r from-gray-400 to-gray-500';
    default:
      return 'bg-gradient-to-r from-primary-500 to-primary-600';
  }
}

export function ProgressBar({ progress, speed, onCancel, className = '' }: ProgressBarProps) {
  const [displayPercentage, setDisplayPercentage] = useState(0);

  // Smoothly animate percentage display
  useEffect(() => {
    const targetPercentage = progress.percentage ?? 0;
    const duration = 300; // Animation duration in ms
    const steps = 30;
    const stepDuration = duration / steps;
    const stepSize = (targetPercentage - displayPercentage) / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayPercentage(targetPercentage);
        clearInterval(interval);
      } else {
        setDisplayPercentage((prev) => prev + stepSize);
      }
    }, stepDuration);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.percentage]);

  const percentage = progress.percentage ?? 0;
  const statusText = getStatusText(progress);
  const statusColor = getStatusColor(progress.status);
  const progressBarColor = getProgressBarColor(progress.status);
  const isActive = progress.status === 'downloading';
  const showCancel = isActive && onCancel;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 ${className}`}
    >
      {/* Status Text */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={isActive ? { rotate: 360 } : {}}
            transition={isActive ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
            className="flex-shrink-0"
          >
            {isActive ? (
              <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            ) : progress.status === 'completed' ? (
              <svg className="h-5 w-5 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : progress.status === 'error' ? (
              <svg className="h-5 w-5 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : null}
          </motion.div>
          <span className={`text-sm font-semibold ${statusColor}`}>
            {statusText}
          </span>
        </div>
        {showCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-error-600 dark:hover:text-error-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 rounded p-1"
            aria-label="Cancel download"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
        {/* Animated background shimmer effect */}
        {isActive && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ width: '50%' }}
          />
        )}

        {/* Progress fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 ${progressBarColor} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercentage}%` }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
            duration: 0.3,
          }}
        />
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between text-xs sm:text-sm">
        {/* Percentage and Size */}
        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">
            {Math.round(displayPercentage)}%
          </span>
          {progress.totalBytes && (
            <span>
              {formatBytes(progress.bytesDownloaded)} / {formatBytes(progress.totalBytes)}
            </span>
          )}
          {!progress.totalBytes && (
            <span>{formatBytes(progress.bytesDownloaded)}</span>
          )}
        </div>

        {/* Speed and ETA */}
        {isActive && speed > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2.5 text-primary-600 dark:text-primary-400"
          >
            <span className="font-semibold">
              {speed.toFixed(2)} MB/s
            </span>
            {(() => {
              const eta = calculateETA(progress.bytesDownloaded, progress.totalBytes, speed);
              return eta ? (
                <motion.span
                  key={eta}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ~{eta}
                </motion.span>
              ) : null;
            })()}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

