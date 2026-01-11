'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DownloadProgress, getProgressUrl, cancelDownload } from './api';
import { ProgressData } from '@/components/ProgressBar';

interface UseDownloadProgressOptions {
  downloadId: string | null;
  enabled?: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseDownloadProgressReturn {
  progress: ProgressData | null;
  speed: number; // MB/s
  isLoading: boolean;
  error: string | null;
  cancel: () => Promise<void>;
}

/**
 * Hook to manage download progress via Server-Sent Events (SSE)
 * Calculates download speed and provides progress updates
 */
export function useDownloadProgress({
  downloadId,
  enabled = true,
  onComplete,
  onError,
}: UseDownloadProgressOptions): UseDownloadProgressReturn {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [speed, setSpeed] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const bytesRef = useRef<number>(0);
  const timeRef = useRef<number>(Date.now());
  const speedHistoryRef = useRef<number[]>([]);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const hasReceivedProgressRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Keep refs in sync with latest callbacks (without causing re-renders)
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // Calculate speed from bytes downloaded over time (inline to avoid dependency issues)
  const updateSpeed = (bytesDownloaded: number) => {
    const now = Date.now();
    const timeDelta = (now - lastUpdateTimeRef.current) / 1000; // seconds
    const bytesDelta = bytesDownloaded - bytesRef.current;

    if (timeDelta > 0 && bytesDelta > 0) {
      const currentSpeed = (bytesDelta / timeDelta) / (1024 * 1024); // MB/s
      
      // Add to history (keep last 5 measurements for smoothing)
      speedHistoryRef.current.push(currentSpeed);
      if (speedHistoryRef.current.length > 5) {
        speedHistoryRef.current.shift();
      }
      
      // Calculate average speed for smoother display
      const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
      setSpeed(avgSpeed);
    }

    bytesRef.current = bytesDownloaded;
    lastUpdateTimeRef.current = now;
  };

  // 🟢 SINGLE SSE CONNECTION (MANDATORY)
  // ONE EventSource, ONLY when downloadId exists, CLOSED on cleanup
  // NO reconnect loops, NO multiple EventSources
  useEffect(() => {
    // Early return if no downloadId or disabled
    if (!downloadId || !enabled) {
      return;
    }

    // Reset state
    setIsLoading(true);
    setError(null);
    setSpeed(0);
    bytesRef.current = 0;
    timeRef.current = Date.now();
    lastUpdateTimeRef.current = Date.now();
    speedHistoryRef.current = [];
    hasReceivedProgressRef.current = false;

    // Create SINGLE EventSource
    const progressUrl = getProgressUrl(downloadId);
    const es = new EventSource(progressUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsLoading(false);
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Ignore connection/heartbeat messages
        if (data.type === 'connected' || data.type === 'heartbeat') {
          return;
        }
        
        // Process progress updates
        if (data.type === 'progress') {
          hasReceivedProgressRef.current = true;
          
          const progressData: ProgressData = {
            downloadId: data.downloadId,
            bytesDownloaded: data.bytesDownloaded || 0,
            totalBytes: data.totalBytes || null,
            percentage: data.percentage || null,
            status: data.status || 'downloading',
            error: data.error,
          };

          setProgress(progressData);

          // Update speed if downloading
          if (progressData.status === 'downloading' && progressData.bytesDownloaded > 0) {
            updateSpeed(progressData.bytesDownloaded);
          }

          // Handle terminal states - close connection
          if (progressData.status === 'completed') {
            setSpeed(0);
            onCompleteRef.current?.();
            es.close();
            eventSourceRef.current = null;
          } else if (progressData.status === 'error') {
            setSpeed(0);
            const errorMessage = progressData.error || 'Download failed';
            setError(errorMessage);
            onErrorRef.current?.(errorMessage);
            es.close();
            eventSourceRef.current = null;
          } else if (progressData.status === 'cancelled') {
            setSpeed(0);
            es.close();
            eventSourceRef.current = null;
          }
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    // Simple error handler - just close on error
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setIsLoading(false);
      
      // Only set error if we haven't received any progress yet
      if (!hasReceivedProgressRef.current) {
        setError('Failed to connect to progress server');
        onErrorRef.current?.('Failed to connect to progress server');
      }
    };

    // Cleanup - CLOSED on cleanup (MANDATORY)
    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsLoading(false);
      setSpeed(0);
    };
  }, [downloadId, enabled]); // ONLY downloadId and enabled in dependencies - NO reconnect loops!

  // Cancel download
  const handleCancel = useCallback(async () => {
    if (!downloadId) return;

    try {
      await cancelDownload(downloadId);
      
      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      setProgress((prev) => 
        prev ? { ...prev, status: 'cancelled' as const } : null
      );
      setSpeed(0);
    } catch (err: any) {
      console.error('Error cancelling download:', err);
      setError(err.message || 'Failed to cancel download');
    }
  }, [downloadId]);

  return {
    progress,
    speed,
    isLoading,
    error,
    cancel: handleCancel,
  };
}

