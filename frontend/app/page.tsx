'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeUrl, analyzeBatch, AnalyzeResponse, BatchAnalyzeResponse, BatchAnalyzeItemResult, FormatInfo, getDownloadUrl, getConvertUrl, downloadMedia, addDownloadJob, addConvertJob, downloadMediaWithJob, convertMediaWithJob, getJob, cancelJob, getQueueState, API_BASE_URL } from '@/lib/api';
import { MediaInfoSkeleton } from '@/components/SkeletonLoader';
import { Disclaimer } from '@/components/Disclaimer';
import { Logo } from '@/components/Logo';
import { ToastContainer, Toast, ToastType } from '@/components/Toast';
import { ProgressBar } from '@/components/ProgressBar';
import { useDownloadProgress } from '@/lib/useDownloadProgress';
import { QueuePanel } from '@/components/QueuePanel';
import { DownloadHistory } from '@/components/DownloadHistory';
import { addToDownloadHistory } from '@/lib/downloadHistory';
import { getPlatformInfo, getPlatformFormatHints, getInstagramContentTypeLabel } from '@/lib/platformUtils';

export default function Home() {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyzeResponse | null>(null);
  const [batchData, setBatchData] = useState<BatchAnalyzeResponse | null>(null);
  const [batchSelectedUrls, setBatchSelectedUrls] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState<Set<string>>(new Set());
  const [downloadIds, setDownloadIds] = useState<Map<string, string>>(new Map()); // formatId -> downloadId
  const [successStates, setSuccessStates] = useState<Set<string>>(new Set()); // formatId -> success
  const [errorStates, setErrorStates] = useState<Set<string>>(new Set()); // formatId -> error
  const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
  const [batchUrlValidation, setBatchUrlValidation] = useState<Map<number, boolean | null>>(new Map());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Toast helper functions
  const showToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Single URL validation
  useEffect(() => {
    if (isBatchMode) {
      setIsValidUrl(null);
      return;
    }

    if (!url.trim()) {
      setIsValidUrl(null);
      return;
    }

    try {
      const urlObj = new URL(url.trim());
      const isValid = (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && urlObj.hostname.length > 0;
      setIsValidUrl(isValid);
    } catch {
      setIsValidUrl(false);
    }
  }, [url, isBatchMode]);

  // Batch URL validation
  useEffect(() => {
    if (!isBatchMode) {
      setBatchUrlValidation(new Map());
      return;
    }

    if (!batchUrls.trim()) {
      setBatchUrlValidation(new Map());
      return;
    }

    const lines = batchUrls.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const validation = new Map<number, boolean | null>();

    lines.forEach((line, index) => {
      try {
        const urlObj = new URL(line);
        const isValid = (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && urlObj.hostname.length > 0;
        validation.set(index, isValid);
      } catch {
        validation.set(index, false);
      }
    });

    setBatchUrlValidation(validation);
  }, [batchUrls, isBatchMode]);

  // Get valid batch URLs
  const getValidBatchUrls = (): string[] => {
    if (!batchUrls.trim()) return [];
    return batchUrls
      .split('\n')
      .map(line => line.trim())
      .filter((line, index) => {
        if (line.length === 0) return false;
        return batchUrlValidation.get(index) === true;
      });
  };

  // Get invalid batch URLs with line numbers
  const getInvalidBatchUrls = (): Array<{ line: number; url: string }> => {
    if (!batchUrls.trim()) return [];
    return batchUrls
      .split('\n')
      .map((line, index) => ({ line: index, url: line.trim() }))
      .filter(({ url, line }) => {
        if (url.length === 0) return false;
        return batchUrlValidation.get(line) === false;
      });
  };

  // Handle paste
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err) {
      // Fallback: focus input and let user paste manually
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  };

  // Handle clear
  const handleClear = () => {
    if (isBatchMode) {
      setBatchUrls('');
      setBatchData(null);
      setBatchSelectedUrls(new Set());
    } else {
      setUrl('');
      setData(null);
    }
    setError(null);
    setIsValidUrl(null);
    setBatchUrlValidation(new Map());
    if (isBatchMode && textareaRef.current) {
      textareaRef.current.focus();
    } else if (!isBatchMode && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle mode toggle
  const handleModeToggle = () => {
    setIsBatchMode(!isBatchMode);
    setError(null);
    setData(null);
    setBatchData(null);
    setBatchSelectedUrls(new Set());
    if (!isBatchMode) {
      // Switching to batch mode - preserve URL in textarea if present
      if (url.trim()) {
        setBatchUrls(url.trim());
        setUrl('');
      }
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      // Switching to single mode - take first URL from batch if present
      if (batchUrls.trim()) {
        const firstUrl = batchUrls.split('\n')[0].trim();
        if (firstUrl) {
          setUrl(firstUrl);
        }
        setBatchUrls('');
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Extract URL from drag data
  const extractUrlFromDrag = (e: React.DragEvent): string | null => {
    // Check for text/plain data (URL as text)
    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      // Try to validate if it's a URL
      try {
        const urlObj = new URL(text.trim());
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          return text.trim();
        }
      } catch {
        // Not a valid URL
      }
    }

    // Check for text/html data (might contain URL in href)
    const html = e.dataTransfer.getData('text/html');
    if (html) {
      // Try to extract URL from HTML (e.g., from links)
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a[href]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href) {
          try {
            const urlObj = new URL(href);
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
              return href;
            }
          } catch {
            // Not a valid URL
          }
        }
      }
    }

    // Check for URL data type
    const urlData = e.dataTransfer.getData('text/uri-list');
    if (urlData) {
      try {
        const urlObj = new URL(urlData.trim());
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          return urlData.trim();
        }
      } catch {
        // Not a valid URL
      }
    }

    return null;
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    // Don't interfere with drags inside input fields or other interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only show drag feedback if dragging text/URL data
    const types = Array.from(e.dataTransfer.types);
    if (types.includes('text/plain') || types.includes('text/html') || types.includes('text/uri-list')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Don't interfere with drags inside input fields or other interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Set drop effect
    const types = Array.from(e.dataTransfer.types);
    if (types.includes('text/plain') || types.includes('text/html') || types.includes('text/uri-list')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Don't interfere with drags inside input fields or other interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide drag feedback if leaving the main container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    // Don't interfere with drops inside input fields or other interactive elements
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return; // Let the browser handle it normally (for text selection)
    }
    
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    // Extract URL from drag data
    const droppedUrl = extractUrlFromDrag(e);
    
    if (!droppedUrl) {
      showToast('No valid URL found in dropped content', 'error');
      return;
    }

    // Validate and set URL
    setUrl(droppedUrl);
    setError(null);
    
    // Focus input
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Auto-trigger analyze
    if (loading) {
      return; // Don't trigger if already loading
    }

    setLoading(true);
    setData(null);

    try {
      const result = await analyzeUrl(droppedUrl);
      setData(result);
      showToast('Media analyzed successfully!', 'success');
    } catch (err: any) {
      // Handle different error types with user-friendly messages
      let errorMessage = 'Failed to analyze URL. Please try again.';
      
      if (err.response?.data?.error?.message) {
        const backendError = err.response.data.error.message;
        
        // Map backend errors to user-friendly messages
        if (backendError.includes('Invalid') || backendError.includes('invalid')) {
          errorMessage = 'The URL format is invalid. Please check and try again.';
        } else if (backendError.includes('Unsupported') || backendError.includes('unsupported')) {
          errorMessage = 'This URL is not supported. Please try a different media URL.';
        } else if (backendError.includes('unavailable') || backendError.includes('private')) {
          errorMessage = 'This media is unavailable or private. Please try a different URL.';
        } else if (backendError.includes('timeout')) {
          errorMessage = 'The request took too long. Please try again or check your internet connection.';
        } else if (backendError.includes('Too many requests') || backendError.includes('rate limit')) {
          errorMessage = 'Too many requests. Please wait a moment before trying again.';
        } else {
          errorMessage = backendError;
        }
      } else if (err.message) {
        if (err.message.includes('Network') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'The request timed out. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isBatchMode) {
      // Batch mode submission
      const validUrls = getValidBatchUrls();
      if (validUrls.length === 0) {
        setError('Please enter at least one valid URL (one per line)');
        return;
      }

      if (loading) {
        return;
      }

      setLoading(true);
      setError(null);
      setBatchData(null);
      setBatchSelectedUrls(new Set());

      try {
        const result = await analyzeBatch(validUrls);
        setBatchData(result);
        
        // Auto-select all successful results
        const successfulUrls = new Set(
          result.results.filter(r => r.success).map(r => r.url)
        );
        setBatchSelectedUrls(successfulUrls);
        
        if (result.successful > 0) {
          showToast(`Analyzed ${result.successful} of ${result.total} URLs successfully`, 'success');
        }
        if (result.failed > 0) {
          showToast(`${result.failed} URL(s) failed to analyze`, 'warning');
        }
      } catch (err: any) {
        let errorMessage = 'Failed to analyze URLs. Please try again.';
        
        if (err.response?.data?.error?.message) {
          errorMessage = err.response.data.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Single URL mode submission
      if (!url.trim()) {
        setError('Please enter a URL');
        return;
      }

      if (loading) {
        return;
      }

      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await analyzeUrl(url.trim());
        setData(result);
        showToast('Media analyzed successfully!', 'success');
      } catch (err: any) {
        // Handle different error types with user-friendly messages
        let errorMessage = 'Failed to analyze URL. Please try again.';
        
        if (err.response?.data?.error?.message) {
          const backendError = err.response.data.error.message;
          
          // Map backend errors to user-friendly messages
          if (backendError.includes('Invalid') || backendError.includes('invalid')) {
            errorMessage = 'The URL format is invalid. Please check and try again.';
          } else if (backendError.includes('Unsupported') || backendError.includes('unsupported')) {
            errorMessage = 'This URL is not supported. Please try a different media URL.';
          } else if (backendError.includes('unavailable') || backendError.includes('private')) {
            errorMessage = 'This media is unavailable or private. Please try a different URL.';
          } else if (backendError.includes('timeout')) {
            errorMessage = 'The request took too long. Please try again or check your internet connection.';
          } else if (backendError.includes('Too many requests') || backendError.includes('rate limit')) {
            errorMessage = 'Too many requests. Please wait a moment before trying again.';
          } else {
            errorMessage = backendError;
          }
        } else if (err.message) {
          if (err.message.includes('Network') || err.message.includes('network')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else if (err.message.includes('timeout')) {
            errorMessage = 'The request timed out. Please try again.';
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-primary-500/10 dark:bg-primary-400/20 backdrop-blur-sm pointer-events-none"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-4 border-dashed border-primary-500 dark:border-primary-400 p-8 md:p-12 max-w-md mx-4"
              >
                <div className="flex flex-col items-center gap-4">
                  <svg 
                    className="h-16 w-16 text-primary-500 dark:text-primary-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      Drop URL here
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Release to analyze the media
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 max-w-4xl">
          {/* Hero Section */}
          <header className="text-center mb-12 md:mb-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Gradient glow effect */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-full max-w-2xl h-full bg-gradient-to-r from-primary-600/20 via-primary-400/10 to-primary-600/20 dark:from-primary-500/30 dark:via-primary-400/20 dark:to-primary-500/30 blur-3xl rounded-full opacity-50"></div>
              </div>
              
              <div className="relative flex flex-col items-center mb-8 md:mb-10">
                <Logo size="lg" animated={true} showText={false} className="mb-6 md:mb-8" />
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-none tracking-tight">
                  <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                    Downly
                  </span>
                </h1>
              </div>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-lg sm:text-xl md:text-2xl font-normal text-gray-700 dark:text-gray-200 max-w-3xl mx-auto leading-relaxed mb-3 md:mb-4"
            >
              Download and convert your favorite media
            </motion.p>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm sm:text-base md:text-lg font-normal text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
            >
              Fast, free, and supports YouTube, TikTok, Instagram, and more
            </motion.p>
          </header>

          {/* Disclaimer */}
          <Disclaimer />

          {/* URL Input Form */}
          <form onSubmit={handleSubmit} className="mb-8 md:mb-10">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 sm:p-6 border border-gray-200 dark:border-gray-700">
              {/* Mode Toggle */}
              <div className="flex items-center justify-between mb-4">
                <label htmlFor={isBatchMode ? "batch-urls" : "url"} className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {isBatchMode ? 'Media URLs (one per line)' : 'Media URL'}
                </label>
                <button
                  type="button"
                  onClick={handleModeToggle}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                  aria-label={isBatchMode ? 'Switch to single URL mode' : 'Switch to batch mode'}
                  disabled={loading}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isBatchMode ? "M4 6h16M4 12h16M4 18h16" : "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"} />
                  </svg>
                  {isBatchMode ? 'Single' : 'Batch'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {isBatchMode ? (
                  /* Batch Mode Input */
                  <div className="relative flex-1">
                    {/* Paste icon */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setBatchUrls(text);
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                          }
                        } catch (err) {
                          if (textareaRef.current) {
                            textareaRef.current.focus();
                            textareaRef.current.select();
                          }
                        }
                      }}
                      className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-1 rounded p-0.5 z-10"
                      aria-label="Paste URLs from clipboard"
                      disabled={loading}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>

                    <textarea
                      ref={textareaRef}
                      id="batch-urls"
                      value={batchUrls}
                      onChange={(e) => setBatchUrls(e.target.value)}
                      placeholder="https://youtube.com/watch?v=...&#10;https://youtube.com/watch?v=...&#10;https://youtube.com/watch?v=..."
                      rows={5}
                      className={`w-full pl-10 pr-10 py-3 text-base border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 resize-y min-h-[120px] font-mono text-sm ${
                        batchUrls.trim() && Array.from(batchUrlValidation.values()).some(v => v === false)
                          ? 'border-error-300 dark:border-error-600 focus:border-error-500 focus:ring-2 focus:ring-error-500/20'
                          : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
                      } ${loading ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700'}`}
                      disabled={loading}
                    />

                    {/* Clear button */}
                    {batchUrls && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-1 rounded p-0.5 z-10"
                        aria-label="Clear URLs"
                        disabled={loading}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  /* Single Mode Input */
                  <div className="relative flex-1">
                    {/* Paste icon */}
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-1 rounded p-0.5 z-10"
                      aria-label="Paste URL from clipboard"
                      disabled={loading}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>

                    {/* Input field */}
                    <input
                      ref={inputRef}
                      type="url"
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className={`w-full pl-10 ${url.trim() && isValidUrl !== null ? 'pr-20' : url ? 'pr-10' : 'pr-10'} py-3 text-base border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 ${
                        isValidUrl === false && url.trim()
                          ? 'border-error-300 dark:border-error-600 focus:border-error-500 focus:ring-2 focus:ring-error-500/20 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]'
                          : isValidUrl === true
                          ? 'border-success-300 dark:border-success-600 focus:border-success-500 focus:ring-2 focus:ring-success-500/20 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.1)]'
                          : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]'
                      } ${loading ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : 'hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700'}`}
                      disabled={loading}
                    />

                    {/* Clear button */}
                    {url && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-1 rounded p-0.5 z-10"
                        aria-label="Clear URL"
                        disabled={loading}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    {/* Validation feedback icon */}
                    {url.trim() && isValidUrl !== null && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        {isValidUrl ? (
                          <svg className="h-5 w-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Analyze button */}
                <button
                  type="submit"
                  disabled={
                    loading ||
                    (isBatchMode
                      ? getValidBatchUrls().length === 0
                      : !url.trim() || isValidUrl === false)
                  }
                  className="relative px-5 sm:px-6 py-2.5 sm:py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-md hover:shadow-primary-500/20 active:shadow-sm disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 min-w-[120px] sm:min-w-[140px] overflow-hidden"
                >
                  {loading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-primary-600">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  )}
                  <span className={`flex items-center justify-center transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                    <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Analyze{isBatchMode ? ' All' : ''}
                  </span>
                </button>
              </div>

              {/* Validation feedback */}
              {isBatchMode ? (
                <>
                  {batchUrls.trim() && (
                    <div className="mt-3 space-y-1">
                      {getValidBatchUrls().length > 0 && (
                        <p className="text-sm font-medium text-success-600 dark:text-success-400 flex items-center">
                          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {getValidBatchUrls().length} valid URL{getValidBatchUrls().length !== 1 ? 's' : ''}
                        </p>
                      )}
                      {getInvalidBatchUrls().length > 0 && (
                        <p className="text-sm font-medium text-error-600 dark:text-error-400 flex items-center">
                          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {getInvalidBatchUrls().length} invalid URL{getInvalidBatchUrls().length !== 1 ? 's' : ''} (will be skipped)
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                url.trim() && isValidUrl === false && (
                  <p className="mt-3 text-sm font-medium text-error-600 dark:text-error-400 flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Please enter a valid URL
                  </p>
                )
              )}

            </div>
          </form>

          {/* Error Message */}
          {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mb-8 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl p-4"
          >
            <div className="flex items-start">
              <svg className="h-5 w-5 text-error-600 dark:text-error-400 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-error-800 dark:text-error-200 text-sm font-medium leading-relaxed">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-3 text-error-600 dark:text-error-400 text-xs font-medium hover:underline transition-colors duration-200 hover:text-error-700 dark:hover:text-error-300 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 focus:ring-offset-error-50 dark:focus:ring-offset-error-900/20 rounded px-2 py-1"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
          )}

          {/* Loading Skeleton */}
          {loading && !data && !batchData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isBatchMode ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <MediaInfoSkeleton />
              )}
            </motion.div>
          )}

          {/* Batch Results */}
          {batchData && !loading && isBatchMode && (
            <BatchResultsDisplay
              batchData={batchData}
              batchSelectedUrls={batchSelectedUrls}
              setBatchSelectedUrls={setBatchSelectedUrls}
              downloading={downloading}
              converting={converting}
              downloadIds={downloadIds}
              successStates={successStates}
              errorStates={errorStates}
              setDownloading={setDownloading}
              setConverting={setConverting}
              setDownloadIds={setDownloadIds}
              setSuccessStates={setSuccessStates}
              setErrorStates={setErrorStates}
              showToast={showToast}
              onBulkQueue={async (urls) => {
                // Handle bulk queue operations
                let queued = 0;
                let failed = 0;
                
                for (const url of urls) {
                  const result = batchData.results.find((r) => r.url === url && r.success);
                  if (result && result.data && result.data.formats.length > 0) {
                    try {
                      // Select best format (first format is typically best quality)
                      const bestFormat = result.data.formats[0];
                      await addDownloadJob(url, bestFormat.format_id);
                      queued++;
                    } catch (err: any) {
                      console.error(`Failed to queue ${url}:`, err);
                      failed++;
                    }
                  } else {
                    failed++;
                  }
                }
                
                // Refresh queue
                window.dispatchEvent(new Event('queue:refresh'));
                
                if (queued > 0) {
                  showToast(`Added ${queued} item(s) to queue${failed > 0 ? `, ${failed} failed` : ''}`, queued === urls.length ? 'success' : 'warning');
                } else if (failed > 0) {
                  showToast('Failed to add items to queue', 'error');
                }
              }}
            />
          )}

          {/* Single Results */}
          {data && !loading && !isBatchMode && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                staggerChildren: 0.1
              }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
            >
              {/* Media Card with Thumbnail and Metadata */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative"
              >
                {/* Thumbnail */}
                {data.thumbnail && (
                  <div className="w-full aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 overflow-hidden relative">
                    <img
                      src={`${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(data.thumbnail)}`}
                      alt={data.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
                  </div>
                )}

                {/* Metadata Overlay */}
                <div className={`${data.thumbnail ? 'absolute bottom-0 left-0 right-0 p-6 md:p-8' : 'p-6 md:p-8'}`}>
                  <div className={`${data.thumbnail ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {/* Platform Icon and Title */}
                    <div className="flex items-start gap-3 mb-3 md:mb-4">
                      {(() => {
                        const platformInfo = getPlatformInfo(url);
                        return (
                          <div className="flex-shrink-0 mt-1">
                            <div className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border ${data.thumbnail ? 'border-white/20' : 'border-gray-200 dark:border-gray-700'}`} title={platformInfo.name}>
                              <svg
                                className={`w-5 h-5 md:w-6 md:h-6 ${data.thumbnail ? 'text-white' : platformInfo.color}`}
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-label={platformInfo.name}
                              >
                                <path d={platformInfo.icon} />
                              </svg>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold drop-shadow-2xl leading-tight">
                          {data.title}
                        </h2>
                        {/* Platform-specific labels */}
                        {(() => {
                          const platformInfo = getPlatformInfo(url);
                          const labels: string[] = [];
                          
                          if (platformInfo.platform === 'instagram' && platformInfo.instagramContentType) {
                            labels.push(getInstagramContentTypeLabel(platformInfo.instagramContentType));
                          }
                          if (platformInfo.isVerticalVideo) {
                            labels.push('Vertical Video');
                          }
                          
                          if (labels.length === 0) return null;
                          
                          return (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {labels.map((label, idx) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold backdrop-blur-sm ${
                                    data.thumbnail
                                      ? 'bg-white/20 text-white border border-white/30'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                                  }`}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    {data.duration && data.duration !== 'unknown' && (
                      <div className="flex items-center gap-4 text-sm md:text-base">
                        <div className={`flex items-center gap-2 ${data.thumbnail ? 'text-white/95' : 'text-gray-600 dark:text-gray-400'} backdrop-blur-sm bg-black/20 px-3 py-1.5 rounded-full`}>
                          <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold">{data.duration}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Formats Selection */}
              <FormatSelection
                url={url}
                formats={data.formats}
                downloading={downloading}
                converting={converting}
                downloadIds={downloadIds}
                successStates={successStates}
                errorStates={errorStates}
                setDownloading={setDownloading}
                setConverting={setConverting}
                setDownloadIds={setDownloadIds}
                setSuccessStates={setSuccessStates}
                setErrorStates={setErrorStates}
                showToast={showToast}
                onDownloadComplete={(formatId) => {
                  const format = data.formats.find(f => f.format_id === formatId);
                  if (format && data) {
                    const platformInfo = getPlatformInfo(url);
                    addToDownloadHistory({
                      url,
                      title: data.title,
                      formatId: format.format_id,
                      formatExt: format.ext,
                      resolution: format.resolution,
                      filesize: format.filesize,
                      thumbnail: data.thumbnail,
                      platform: platformInfo.name,
                      formatType: format.type,
                    });
                  }
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Queue Panel */}
      <QueuePanel />

      {/* Download History */}
      <DownloadHistory 
        onDownload={async (url, formatId) => {
          // Re-download: analyze URL first, then auto-download
          try {
            setLoading(true);
            setError(null);
            const result = await analyzeUrl(url);
            setData(result);
            setUrl(url);
            showToast('Media loaded. Starting download...', 'success');
            
            // Small delay to let UI update, then trigger download
            setTimeout(async () => {
              // Find the format and trigger download directly
              const format = result.formats.find(f => f.format_id === formatId);
              if (format) {
                // Use the same download flow as handleDownload
                try {
                  // 🟢 SMART: Disable adding jobs while active to prevent overload
                  try {
                    const queueState = await getQueueState();
                    if (queueState.processingCount >= 1) {
                      showToast('Please wait for current job to finish', 'error');
                      setDownloading((prev) => {
                        const next = new Set(prev);
                        next.delete(formatId);
                        return next;
                      });
                      return;
                    }
                  } catch (error) {
                    // If queue check fails, continue anyway (don't block user)
                    console.warn('Failed to check queue state:', error);
                  }

                  setDownloading((prev) => new Set(prev).add(formatId));
                  
                  const { jobId, canStart } = await addDownloadJob(url, formatId);
                  
                  // 🟢 PULL ONLY ON CHANGE: Refresh queue after enqueue
                  window.dispatchEvent(new Event('queue:refresh'));
                  
                  if (!canStart) {
                    // 🟢 DEBUG MODE: Polling removed - job is queued, will be processed automatically
                    showToast('Download added to queue', 'success');
                    setDownloading((prev) => {
                      const next = new Set(prev);
                      next.delete(formatId);
                      return next;
                    });
                  } else {
                    const { downloadId, blob } = await downloadMediaWithJob(jobId);
                    setDownloadIds((prev) => new Map(prev).set(formatId, downloadId));
                    
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = '';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
                    showToast('Download completed!', 'success');
                    
                    // Add to history
                    const platformInfo = getPlatformInfo(url);
                    addToDownloadHistory({
                      url,
                      title: result.title,
                      formatId: format.format_id,
                      formatExt: format.ext,
                      resolution: format.resolution,
                      filesize: format.filesize,
                      thumbnail: result.thumbnail,
                      platform: platformInfo.name,
                      formatType: format.type,
                    });
                    
                    // 🟢 PULL ONLY ON CHANGE: Refresh queue after job completes
                    window.dispatchEvent(new Event('queue:refresh'));
                  }
                  
                  setTimeout(() => {
                    setDownloading((prev) => {
                      const next = new Set(prev);
                      next.delete(formatId);
                      return next;
                    });
                  }, 1000);
                } catch (err: any) {
                  console.error('Re-download error:', err);
                  showToast(err.message || 'Download failed', 'error');
                  setDownloading((prev) => {
                    const next = new Set(prev);
                    next.delete(formatId);
                    return next;
                  });
                }
              }
            }, 500);
          } catch (err: any) {
            console.error('Error loading media for re-download:', err);
            showToast('Failed to load media. Please try again.', 'error');
          } finally {
            setLoading(false);
          }
        }}
      />

      {/* Supporting Sections */}
      <div className="container mx-auto px-4 sm:px-6 py-12 md:py-20 max-w-6xl">
        {/* Supported Platforms */}
        <section className="mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10 md:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
              Supported Platforms
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Download and convert media from your favorite platforms
            </p>
          </motion.div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
            {[
              { name: 'YouTube', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z', color: 'text-red-600 dark:text-red-400' },
              { name: 'TikTok', icon: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z', color: 'text-gray-900 dark:text-white' },
              { name: 'Instagram', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z', color: 'text-pink-600 dark:text-pink-400' },
              { name: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', color: 'text-primary-600 dark:text-primary-400' },
            ].map((platform, index) => (
              <motion.div
                key={platform.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="group"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 text-center">
                  <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 ${platform.color}`}>
                    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24" aria-label={platform.name}>
                      <path d={platform.icon} />
                    </svg>
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    {platform.name}
                  </h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10 md:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
              How It Works
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Download your favorite media in just a few simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                step: '01',
                title: 'Paste URL',
                description: 'Copy and paste the media URL from your favorite platform into the input field',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Analyze & Select',
                description: 'Our system analyzes the media and presents all available formats and quality options',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Download & Enjoy',
                description: 'Choose your preferred format, click download, and enjoy your media offline',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                ),
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-7 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg">
                      {item.step}
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 text-primary-600 dark:text-primary-400 mt-1">
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Why Downly */}
        <section className="mb-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4 }}
            className="text-center mb-10 md:mb-12"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">
              Why Downly
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need for seamless media downloads
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {[
              {
                title: 'Free & Fast',
                description: 'No subscriptions or hidden fees. Download media quickly and efficiently',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                gradient: 'from-yellow-500 to-orange-500',
              },
              {
                title: 'Multiple Formats',
                description: 'Download videos and audio in various formats and quality levels',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                ),
                gradient: 'from-blue-500 to-cyan-500',
              },
              {
                title: 'Easy Conversion',
                description: 'Convert videos to MP3 or MP4 with just one click',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ),
                gradient: 'from-purple-500 to-pink-500',
              },
              {
                title: 'No Registration',
                description: 'Start downloading immediately without creating an account',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
                gradient: 'from-green-500 to-emerald-500',
              },
              {
                title: 'High Quality',
                description: 'Download media in the highest available quality, including 4K',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
                gradient: 'from-indigo-500 to-purple-500',
              },
              {
                title: 'Privacy Focused',
                description: 'Your downloads are processed securely without storing your data',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                gradient: 'from-red-500 to-rose-500',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 h-full">
                  <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${feature.gradient} text-white mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 py-6 md:py-8 max-w-4xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-3">
              <Logo size="sm" animated={false} showText={true} />
              <span className="text-gray-400">•</span>
              <p className="text-center sm:text-left">
                © {new Date().getFullYear()} Educational purposes only.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/terms"
                className="hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:underline active:opacity-70"
              >
                Terms of Service
              </a>
              <span className="text-gray-400">•</span>
              <a
                href="/privacy"
                className="hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:underline active:opacity-70"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Batch Results Display Component
 * Shows grouped results for batch analyze with individual status and bulk operations
 */
function BatchResultsDisplay({
  batchData,
  batchSelectedUrls,
  setBatchSelectedUrls,
  downloading,
  converting,
  downloadIds,
  successStates,
  errorStates,
  setDownloading,
  setConverting,
  setDownloadIds,
  setSuccessStates,
  setErrorStates,
  showToast,
  onBulkQueue,
}: {
  batchData: BatchAnalyzeResponse;
  batchSelectedUrls: Set<string>;
  setBatchSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  downloading: Set<string>;
  converting: Set<string>;
  downloadIds: Map<string, string>;
  successStates: Set<string>;
  errorStates: Set<string>;
  setDownloading: React.Dispatch<React.SetStateAction<Set<string>>>;
  setConverting: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDownloadIds: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setSuccessStates: React.Dispatch<React.SetStateAction<Set<string>>>;
  setErrorStates: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (message: string, type: ToastType) => void;
  onBulkQueue: (urls: string[]) => void;
}) {
  const successfulResults = batchData.results.filter((r) => r.success);
  const failedResults = batchData.results.filter((r) => !r.success);
  const allSuccessfulSelected = successfulResults.length > 0 && successfulResults.every((r) => batchSelectedUrls.has(r.url));
  const someSuccessfulSelected = successfulResults.some((r) => batchSelectedUrls.has(r.url));

  const handleSelectAll = () => {
    if (allSuccessfulSelected) {
      setBatchSelectedUrls(new Set());
    } else {
      setBatchSelectedUrls(new Set(successfulResults.map((r) => r.url)));
    }
  };

  const handleToggleSelection = (url: string) => {
    setBatchSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleBulkQueue = () => {
    const urlsToQueue = Array.from(batchSelectedUrls);
    if (urlsToQueue.length === 0) {
      showToast('Please select at least one item to queue', 'warning');
      return;
    }
    onBulkQueue(urlsToQueue);
    showToast(`Added ${urlsToQueue.length} item(s) to queue`, 'success');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      {/* Header with Summary and Bulk Actions */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Batch Analysis Results</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-success-600 dark:text-success-400 font-medium">
                ✓ {batchData.successful} successful
              </span>
              {batchData.failed > 0 && (
                <span className="text-error-600 dark:text-error-400 font-medium">
                  ✗ {batchData.failed} failed
                </span>
              )}
              <span className="text-gray-600 dark:text-gray-400">
                {batchData.total} total
              </span>
            </div>
          </div>
          {successfulResults.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                {allSuccessfulSelected ? 'Deselect All' : 'Select All'}
              </button>
              {batchSelectedUrls.size > 0 && (
                <button
                  onClick={handleBulkQueue}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                >
                  Add Selected to Queue ({batchSelectedUrls.size})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
        {batchData.results.map((result, index) => (
          <motion.div
            key={result.url}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
              result.success ? '' : 'bg-error-50/50 dark:bg-error-900/10'
            }`}
          >
            {result.success && result.data ? (
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Checkbox for selection */}
                <div className="flex-shrink-0 pt-1">
                  <input
                    type="checkbox"
                    checked={batchSelectedUrls.has(result.url)}
                    onChange={() => handleToggleSelection(result.url)}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                </div>

                {/* Thumbnail */}
                {result.data.thumbnail && (
                  <div className="flex-shrink-0 w-32 h-20 sm:w-40 sm:h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                    <img
                      src={`${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(result.data.thumbnail)}`}
                      alt={result.data.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate mb-1">
                        {result.data.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mb-2">
                        {result.url}
                      </p>
                      {result.data.duration && result.data.duration !== 'unknown' && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {result.data.duration}
                        </div>
                      )}
                    </div>
                    <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-success-700 dark:text-success-300 bg-success-100 dark:bg-success-900/30">
                      Success
                    </span>
                  </div>

                  {/* Format Count */}
                  <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                    {result.data.formats.length} format{result.data.formats.length !== 1 ? 's' : ''} available
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {result.data.formats.length > 0 && (
                      <button
                        onClick={async () => {
                          const bestFormat = result.data!.formats[0];
                          try {
                            const { jobId } = await addDownloadJob(result.url, bestFormat.format_id);
                            window.dispatchEvent(new Event('queue:refresh'));
                            showToast('Added to queue', 'success');
                          } catch (err: any) {
                            showToast(err.message || 'Failed to add to queue', 'error');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                      >
                        Queue Best Format
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-error-700 dark:text-error-300 bg-error-100 dark:bg-error-900/30">
                  Failed
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Analysis Failed</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mb-2">
                    {result.url}
                  </p>
                  <p className="text-sm text-error-600 dark:text-error-400">
                    {result.error || 'Unknown error occurred'}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Helper function to get quality level and styling
 */
function getQualityLevel(resolution: string): {
  level: 'premium' | 'high' | 'medium' | 'low' | 'standard';
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
} {
  const res = resolution.toLowerCase();
  
  // Video quality detection
  if (res.includes('4k') || res.includes('2160p') || res.includes('1440p')) {
    return {
      level: 'premium',
      color: 'text-purple-700 dark:text-purple-300',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      borderColor: 'border-purple-300 dark:border-purple-700',
      label: 'Premium',
    };
  }
  if (res.includes('1080p') || res.includes('1080')) {
    return {
      level: 'high',
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-300 dark:border-blue-700',
      label: 'High',
    };
  }
  if (res.includes('720p') || res.includes('720')) {
    return {
      level: 'medium',
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-300 dark:border-green-700',
      label: 'Medium',
    };
  }
  if (res.includes('480p') || res.includes('480') || res.includes('360p') || res.includes('360')) {
    return {
      level: 'low',
      color: 'text-orange-700 dark:text-orange-300',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      borderColor: 'border-orange-300 dark:border-orange-700',
      label: 'Standard',
    };
  }
  
  // Audio quality detection
  if (res.includes('320') || res.includes('256')) {
    return {
      level: 'high',
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-300 dark:border-blue-700',
      label: 'High',
    };
  }
  if (res.includes('192') || res.includes('128')) {
    return {
      level: 'medium',
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      borderColor: 'border-green-300 dark:border-green-700',
      label: 'Medium',
    };
  }
  
  // Default
  return {
    level: 'standard',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-700/50',
    borderColor: 'border-gray-300 dark:border-gray-600',
    label: 'Standard',
  };
}

/**
 * Format Progress Component
 * Displays progress bar for a specific download
 */
function FormatProgress({
  formatId,
  downloadId,
  onCancel,
}: {
  formatId: string;
  downloadId: string;
  onCancel?: () => void;
}) {
  const { progress, speed, cancel } = useDownloadProgress({
    downloadId,
    enabled: true,
    onComplete: () => {
      // Progress completed
    },
    onError: (error) => {
      console.error('Download progress error:', error);
    },
  });

  const handleCancel = async () => {
    await cancel();
    onCancel?.();
  };

  if (!progress) {
    return null;
  }

  return (
    <div className="mt-4">
      <ProgressBar
        progress={progress}
        speed={speed}
        onCancel={handleCancel}
      />
    </div>
  );
}

/**
 * Parses filesize string to bytes for comparison
 * Examples: "50.2 MB" -> 52638515, "1.2 GB" -> 1288490188
 */
function parseFilesize(filesize: string): number {
  if (filesize === 'unknown') return Infinity;
  
  const match = filesize.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return Infinity;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };
  
  return value * (multipliers[unit] || 1);
}

/**
 * Extracts resolution number from resolution string for comparison
 * Examples: "1080p" -> 1080, "720p" -> 720, "4K" -> 2160
 */
function parseResolution(resolution: string): number {
  const lower = resolution.toLowerCase();
  
  // Handle 4K
  if (lower.includes('4k') || lower.includes('2160')) return 2160;
  if (lower.includes('1440')) return 1440;
  if (lower.includes('1080')) return 1080;
  if (lower.includes('720')) return 720;
  if (lower.includes('480')) return 480;
  if (lower.includes('360')) return 360;
  if (lower.includes('240')) return 240;
  if (lower.includes('144')) return 144;
  
  // Try to extract number
  const match = resolution.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  
  return 0;
}

/**
 * Preset types for smart format selection
 */
export type FormatPreset = 'best-quality' | 'smallest-size' | 'audio-only' | 'mobile-optimized';

/**
 * Preset configuration with labels and descriptions
 */
const PRESET_CONFIG: Record<FormatPreset, { label: string; description: string; icon: string }> = {
  'best-quality': {
    label: 'Best Quality',
    description: 'Highest resolution available',
    icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
  },
  'smallest-size': {
    label: 'Smallest Size',
    description: 'Lowest file size',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
  },
  'audio-only': {
    label: 'Audio Only',
    description: 'Best audio quality',
    icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  },
  'mobile-optimized': {
    label: 'Mobile Optimized',
    description: '720p or 480p for mobile',
    icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
};

/**
 * Determines format recommendations based on preset
 */
function getFormatRecommendations(
  formats: FormatInfo[],
  preset: FormatPreset = 'best-quality'
): {
  recommended: string | null;
  bestQuality: string | null;
  smallestSize: string | null;
  audioOnly: string | null;
  mobileOptimized: string | null;
} {
  if (formats.length === 0) {
    return {
      recommended: null,
      bestQuality: null,
      smallestSize: null,
      audioOnly: null,
      mobileOptimized: null,
    };
  }

  let bestQuality: FormatInfo | null = null;
  let smallestSize: FormatInfo | null = null;
  let audioOnly: FormatInfo | null = null;
  let mobileOptimized: FormatInfo | null = null;
  
  let highestResolution = -1;
  let smallestSizeBytes = Infinity;
  let highestAudioQuality = -1;
  let bestMobileFormat: FormatInfo | null = null;
  let bestMobileScore = Infinity;

  for (const format of formats) {
    const resolution = parseResolution(format.resolution);
    const sizeBytes = parseFilesize(format.filesize);

    // Best Quality: Highest resolution
    if (resolution > highestResolution) {
      highestResolution = resolution;
      bestQuality = format;
    }

    // Smallest Size: Lowest file size
    if (sizeBytes < smallestSizeBytes && sizeBytes !== Infinity) {
      smallestSizeBytes = sizeBytes;
      smallestSize = format;
    }

    // Audio Only: Best audio quality (highest bitrate/resolution for audio)
    if (format.type === 'audio') {
      const audioQuality = parseResolution(format.resolution); // For audio, resolution might be bitrate
      if (audioQuality > highestAudioQuality) {
        highestAudioQuality = audioQuality;
        audioOnly = format;
      }
    }

    // Mobile Optimized: 720p or 480p, prefer smaller size
    if (format.type === 'video') {
      const res = resolution;
      if (res === 720 || res === 480) {
        // Score: prefer 720p, then smaller size
        const score = (res === 720 ? 0 : 1000) + sizeBytes / (1024 * 1024); // MB as tiebreaker
        if (score < bestMobileScore) {
          bestMobileScore = score;
          mobileOptimized = format;
        }
      }
    }
  }

  // Fallback: If no exact mobile match, use 720p or closest lower resolution
  if (!mobileOptimized && formats.length > 0) {
    const videoFormats = formats.filter(f => f.type === 'video');
    if (videoFormats.length > 0) {
      // Find 720p first, then 480p, then highest resolution <= 1080p
      mobileOptimized = videoFormats.find(f => parseResolution(f.resolution) === 720) ||
                       videoFormats.find(f => parseResolution(f.resolution) === 480) ||
                       videoFormats
                         .filter(f => parseResolution(f.resolution) <= 1080)
                         .sort((a, b) => parseFilesize(a.filesize) - parseFilesize(b.filesize))[0] ||
                       null;
    }
  }

  // Determine recommended format based on preset
  let recommended: string | null = null;
  switch (preset) {
    case 'best-quality':
      recommended = bestQuality?.format_id || null;
      break;
    case 'smallest-size':
      recommended = smallestSize?.format_id || null;
      break;
    case 'audio-only':
      recommended = audioOnly?.format_id || null;
      break;
    case 'mobile-optimized':
      recommended = mobileOptimized?.format_id || null;
      break;
  }

  return {
    recommended,
    bestQuality: bestQuality?.format_id || null,
    smallestSize: smallestSize?.format_id || null,
    audioOnly: audioOnly?.format_id || null,
    mobileOptimized: mobileOptimized?.format_id || null,
  };
}

/**
 * Format Selection Component
 * Groups formats by type and displays download/convert options with tabs
 */
function FormatSelection({
  url,
  formats,
  downloading,
  converting,
  downloadIds,
  successStates,
  errorStates,
  setDownloading,
  setConverting,
  setDownloadIds,
  setSuccessStates,
  setErrorStates,
  showToast,
  onDownloadComplete,
}: {
  url: string;
  formats: FormatInfo[];
  downloading: Set<string>;
  converting: Set<string>;
  downloadIds: Map<string, string>;
  successStates: Set<string>;
  errorStates: Set<string>;
  setDownloading: React.Dispatch<React.SetStateAction<Set<string>>>;
  setConverting: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDownloadIds: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setSuccessStates: React.Dispatch<React.SetStateAction<Set<string>>>;
  setErrorStates: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (message: string, type: ToastType) => void;
  onDownloadComplete?: (formatId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [selectedPreset, setSelectedPreset] = useState<FormatPreset>('best-quality');
  
  // Get platform info for format hints
  const platformInfo = getPlatformInfo(url);
  const formatHints = getPlatformFormatHints(platformInfo.platform);
  
  // Group formats by type
  const videoFormats = formats.filter((f) => f.type === 'video');
  const audioFormats = formats.filter((f) => f.type === 'audio');
  
  // Get recommendations for current tab based on preset
  const currentFormats = activeTab === 'video' ? videoFormats : audioFormats;
  
  // Adjust tab if needed based on preset selection
  useEffect(() => {
    if (selectedPreset === 'audio-only' && activeTab === 'video' && audioFormats.length > 0) {
      setActiveTab('audio');
    } else if (selectedPreset === 'mobile-optimized' && activeTab === 'audio' && videoFormats.length > 0) {
      setActiveTab('video');
    }
  }, [selectedPreset, activeTab, audioFormats.length, videoFormats.length]);
  
  const recommendations = getFormatRecommendations(currentFormats, selectedPreset);
  
  // Set initial tab based on available formats
  useEffect(() => {
    if (videoFormats.length > 0) {
      setActiveTab('video');
    } else if (audioFormats.length > 0) {
      setActiveTab('audio');
    }
  }, [formats, videoFormats.length, audioFormats.length]);

  // Auto-clear success states after 2 seconds
  useEffect(() => {
    if (successStates.size > 0) {
      const timers = Array.from(successStates).map((formatId) => {
        return setTimeout(() => {
          setSuccessStates((prev) => {
            const next = new Set(prev);
            next.delete(formatId);
            return next;
          });
        }, 2000);
      });
      return () => timers.forEach(clearTimeout);
    }
  }, [successStates, setSuccessStates]);

  // Auto-clear error states after 3 seconds
  useEffect(() => {
    if (errorStates.size > 0) {
      const timers = Array.from(errorStates).map((formatId) => {
        return setTimeout(() => {
          setErrorStates((prev) => {
            const next = new Set(prev);
            next.delete(formatId);
            return next;
          });
        }, 3000);
      });
      return () => timers.forEach(clearTimeout);
    }
  }, [errorStates, setErrorStates]);

  const handleDownload = async (formatId: string) => {
    // Prevent duplicate downloads
    if (downloading.has(formatId)) {
      return;
    }

    // 🟢 SMART: Disable adding jobs while active to prevent overload
    try {
      const queueState = await getQueueState();
      if (queueState.processingCount >= 1) {
        showToast('Please wait for current job to finish', 'error');
        return;
      }
    } catch (error) {
      // If queue check fails, continue anyway (don't block user)
      console.warn('Failed to check queue state:', error);
    }

    // Track download state
    setDownloading((prev) => new Set(prev).add(formatId));
    
    try {
      // Add job to queue
      const { jobId, canStart } = await addDownloadJob(url, formatId);
      
      // 🟢 PULL ONLY ON CHANGE: Refresh queue after enqueue
      window.dispatchEvent(new Event('queue:refresh'));
      
      if (!canStart) {
        // 🟢 DEBUG MODE: Polling removed - job is queued, will be processed automatically
        showToast('Download added to queue', 'success');
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(formatId);
          return next;
        });
        return;
      }

      // Can start immediately
      const { downloadId, blob } = await downloadMediaWithJob(jobId);
      
      // Store downloadId for progress tracking
      setDownloadIds((prev) => new Map(prev).set(formatId, downloadId));
      
      showToast('Download started!', 'success');
      
      // Create blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
      showToast('Download completed!', 'success');
      setSuccessStates((prev) => new Set(prev).add(formatId));
      onDownloadComplete?.(formatId);
      
      // 🟢 PULL ONLY ON CHANGE: Refresh queue after job completes
      window.dispatchEvent(new Event('queue:refresh'));
    } catch (error: any) {
      console.error('Download error:', error);
      
      // User-friendly error message
      let errorMessage = 'Download failed. Please try again.';
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Download timed out. The file may be too large. Please try again.';
        } else if (error.message.includes('Failed to connect')) {
          errorMessage = 'Failed to connect to server. Please check your connection.';
        } else if (error.message.includes('queued')) {
          // Don't show error for queued status
          return;
        } else {
          errorMessage = error.message;
        }
      }
      
      showToast(errorMessage, 'error');
      setErrorStates((prev) => new Set(prev).add(formatId));
      
      // Clear downloadId on error
      setDownloadIds((prev) => {
        const next = new Map(prev);
        next.delete(formatId);
        return next;
      });
    } finally {
      // Clear download state after a delay
      setTimeout(() => {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(formatId);
          return next;
        });
        // Clear downloadId after progress is done (give it time to show completion)
        setTimeout(() => {
          setDownloadIds((prev) => {
            const next = new Map(prev);
            next.delete(formatId);
            return next;
          });
        }, 3000); // Keep progress visible for 3 seconds after completion
      }, 1000);
    }
  };

  const handleConvert = async (formatId: string, targetFormat: string) => {
    // Prevent duplicate conversions
    if (converting.has(formatId)) {
      return;
    }

    // 🟢 SMART: Disable adding jobs while active to prevent overload
    try {
      const queueState = await getQueueState();
      if (queueState.processingCount >= 1) {
        showToast('Please wait for current job to finish', 'error');
        return;
      }
    } catch (error) {
      // If queue check fails, continue anyway (don't block user)
      console.warn('Failed to check queue state:', error);
    }

    setConverting((prev) => new Set(prev).add(formatId));
    
    try {
      // Add job to queue
      const { jobId, canStart } = await addConvertJob(url, targetFormat);
      
      // 🟢 PULL ONLY ON CHANGE: Refresh queue after enqueue
      window.dispatchEvent(new Event('queue:refresh'));
      
      if (!canStart) {
        // 🟢 DEBUG MODE: Polling removed - job is queued, will be processed automatically
        showToast('Conversion added to queue', 'success');
        setConverting((prev) => {
          const next = new Set(prev);
          next.delete(formatId);
          return next;
        });
        return;
      }

      // Can start immediately
      const blob = await convertMediaWithJob(jobId);
      
      // Create blob URL for download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      showToast(`Successfully converted to ${targetFormat.toUpperCase()}!`, 'success');
      
      // 🟢 PULL ONLY ON CHANGE: Refresh queue after job completes
      window.dispatchEvent(new Event('queue:refresh'));
    } catch (error: any) {
      console.error('Conversion error:', error);
      
      // User-friendly error message
      let errorMessage = 'Conversion failed. Please try again.';
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Conversion timed out. The file may be too large. Please try again.';
        } else if (error.message.includes('Unsupported') || error.message.includes('invalid')) {
          errorMessage = 'This format cannot be converted. Please try a different format.';
        } else if (error.message.includes('queued')) {
          // Don't show error for queued status
          return;
        } else {
          errorMessage = error.message;
        }
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setConverting((prev) => {
        const next = new Set(prev);
        next.delete(formatId);
        return next;
      });
    }
  };

  const renderFormatCard = (format: FormatInfo) => {
    const isDownloading = downloading.has(format.format_id);
    const isConverting = converting.has(format.format_id);
    const isProcessing = isDownloading || isConverting;
    const isSuccess = successStates.has(format.format_id);
    const isError = errorStates.has(format.format_id);
    const quality = getQualityLevel(format.resolution);
    const downloadId = downloadIds.get(format.format_id) || null;
    
    // Check if this format is recommended based on current preset
    const isRecommended = recommendations.recommended === format.format_id;
    const isBestQuality = recommendations.bestQuality === format.format_id;
    const isSmallestSize = recommendations.smallestSize === format.format_id;
    const isAudioOnly = recommendations.audioOnly === format.format_id;
    const isMobileOptimized = recommendations.mobileOptimized === format.format_id;
    
    // Note: Success/error state cleanup is handled at component level

    // Get button colors based on quality
    const getDownloadButtonClass = () => {
      if (quality.level === 'premium') {
        return 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900 focus:ring-purple-500';
      } else if (quality.level === 'high') {
        return 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus:ring-blue-500';
      } else if (quality.level === 'medium') {
        return 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 focus:ring-green-500';
      } else {
        return 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 active:from-gray-800 active:to-gray-900 focus:ring-gray-500';
      }
    };

    return (
      <div
        key={format.format_id}
              className={`group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl p-4 sm:p-5 border ${
          isRecommended 
            ? 'border-primary-400 dark:border-primary-600 ring-2 ring-primary-200 dark:ring-primary-800/50 shadow-md' 
            : quality.borderColor
        } transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.005] hover:border-opacity-100 active:scale-[0.998] active:translate-y-0 ${isProcessing ? 'opacity-60 cursor-wait' : 'cursor-default'} ${isRecommended ? 'bg-gradient-to-br from-primary-50/50 to-white dark:from-primary-900/10 dark:to-gray-800' : ''}`}
      >
        {/* Recommended Badge */}
        {isRecommended && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="relative group/recommendation">
              <div className="absolute inset-0 bg-primary-500 rounded-full blur-sm opacity-50 animate-pulse" />
              <div className="relative bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Recommended</span>
              </div>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-56 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/recommendation:opacity-100 group-hover/recommendation:visible transition-all duration-200 z-20 pointer-events-none">
                {selectedPreset === 'best-quality' && (
                  <p>Recommended: Best quality available</p>
                )}
                {selectedPreset === 'smallest-size' && (
                  <p>Recommended: Smallest file size</p>
                )}
                {selectedPreset === 'audio-only' && (
                  <p>Recommended: Best audio quality</p>
                )}
                {selectedPreset === 'mobile-optimized' && (
                  <p>Recommended: Optimized for mobile devices</p>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Progress indicator overlay */}
        {isDownloading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-xl animate-pulse" />
        )}
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Format Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2.5 sm:mb-3 flex-wrap">
              <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${quality.bgColor} ${quality.color} border ${quality.borderColor}`}>
                {format.ext}
              </span>
              <span className={`text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate ${
                formatHints.showResolution ? 'font-extrabold' : ''
              }`}>
                {format.resolution}
              </span>
              {/* Platform-specific codec hint for YouTube */}
              {formatHints.showCodec && format.ext && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  {format.ext.toUpperCase()} Codec
                </span>
              )}
              {quality.level !== 'standard' && (
                <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-semibold ${quality.bgColor} ${quality.color}`}>
                  {quality.label}
                </span>
              )}
              {/* Vertical video indicator for TikTok */}
              {formatHints.showVerticalIndicator && format.type === 'video' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Vertical
                </span>
              )}
              {/* Recommendation indicators - show all applicable, but highlight the preset recommendation */}
              {isBestQuality && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                  isRecommended && selectedPreset === 'best-quality'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-700'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`} title="Best quality">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Best
                </span>
              )}
              {isSmallestSize && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                  isRecommended && selectedPreset === 'smallest-size'
                    ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-700'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`} title="Smallest file size">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  Smallest
                </span>
              )}
              {isAudioOnly && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                  isRecommended && selectedPreset === 'audio-only'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`} title="Best audio quality">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Audio
                </span>
              )}
              {isMobileOptimized && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                  isRecommended && selectedPreset === 'mobile-optimized'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                }`} title="Mobile optimized">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Mobile
                </span>
              )}
            </div>
            {format.filesize !== 'unknown' && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span>{format.filesize}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:flex-shrink-0">
            {/* Direct Download Button */}
            <button
              onClick={() => handleDownload(format.format_id)}
              disabled={isProcessing}
              className={`relative px-5 sm:px-6 py-2.5 sm:py-3 ${
                isSuccess 
                  ? 'bg-success-600 hover:bg-success-700' 
                  : isError 
                  ? 'bg-error-600 hover:bg-error-700' 
                  : getDownloadButtonClass()
              } disabled:bg-gray-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 shadow-sm hover:shadow-md active:shadow-sm overflow-hidden group/btn`}
              aria-label={`Download ${format.ext} ${format.resolution}`}
            >
              {/* Success Indicator */}
              {isSuccess && !isProcessing && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center bg-success-600"
                >
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
              
              {/* Error Indicator */}
              {isError && !isProcessing && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center bg-error-600"
                >
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.div>
              )}
              {isDownloading && (
                <>
                  <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-white drop-shadow-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                </>
              )}
              <span className={`relative flex items-center justify-center transition-opacity duration-300 ${
                isDownloading || isSuccess || isError ? 'opacity-0' : 'opacity-100'
              }`}>
                <svg className="h-4 w-4 mr-2 group-hover/btn:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isDownloading ? 'Downloading...' : isSuccess ? 'Downloaded!' : isError ? 'Failed' : 'Download'}
              </span>
            </button>

            {/* Convert Buttons (only for video formats) */}
            {format.type === 'video' && (
              <>
                <button
                  onClick={() => handleConvert(format.format_id, 'mp3')}
                  disabled={isProcessing}
                  className="relative px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 active:from-pink-800 active:to-pink-900 disabled:bg-gray-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 shadow-sm hover:shadow-md active:shadow-sm overflow-hidden"
                  aria-label={`Convert to MP3`}
                >
                  {isConverting && (
                    <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-pink-600 to-pink-700">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  )}
                  <span className={`flex items-center justify-center transition-opacity duration-300 ${isConverting ? 'opacity-0' : 'opacity-100'}`}>
                    <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    MP3
                  </span>
                </button>
                {format.ext !== 'mp4' && (
                  <button
                    onClick={() => handleConvert(format.format_id, 'mp4')}
                    disabled={isProcessing}
                    className="relative px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 active:from-orange-800 active:to-orange-900 disabled:bg-gray-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 shadow-sm hover:shadow-md active:shadow-sm overflow-hidden"
                    aria-label={`Convert to MP4`}
                  >
                    {isConverting && (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-orange-600 to-orange-700">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>
                    )}
                    <span className={`flex items-center justify-center transition-opacity duration-300 ${isConverting ? 'opacity-0' : 'opacity-100'}`}>
                      <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      MP4
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <AnimatePresence>
          {downloadId && (
            <FormatProgress
              key={downloadId}
              formatId={format.format_id}
              downloadId={downloadId}
              onCancel={() => {
                // Clear download state when cancelled
                setDownloading((prev) => {
                  const next = new Set(prev);
                  next.delete(format.format_id);
                  return next;
                });
                setDownloadIds((prev) => {
                  const next = new Map(prev);
                  next.delete(format.format_id);
                  return next;
                });
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="p-5 sm:p-6 md:p-8"
    >
      {/* Segmented Control Tabs */}
      {(videoFormats.length > 0 && audioFormats.length > 0) && (
        <div className="mb-6 md:mb-8 -mx-5 sm:-mx-6 md:-mx-8 px-5 sm:px-6 md:px-8">
          <div className="inline-flex bg-gray-100 dark:bg-gray-700/50 p-1.5 rounded-xl border border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setActiveTab('video')}
              className={`relative px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'video'
                  ? 'text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {activeTab === 'video' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Video
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'video'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}>
                  {videoFormats.length}
                </span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`relative px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'audio'
                  ? 'text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {activeTab === 'audio' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Audio
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  activeTab === 'audio'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                }`}>
                  {audioFormats.length}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Preset Selector */}
      {currentFormats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Smart Presets</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESET_CONFIG) as FormatPreset[]).map((preset) => {
                const config = PRESET_CONFIG[preset];
                const isSelected = selectedPreset === preset;
                // Determine availability based on preset type and current tab
                const isAvailable = 
                  (preset === 'audio-only' && audioFormats.length > 0) ||
                  (preset === 'mobile-optimized' && videoFormats.length > 0) ||
                  ((preset === 'best-quality' || preset === 'smallest-size') && currentFormats.length > 0);
                
                if (!isAvailable) return null;
                
                return (
                  <button
                    key={preset}
                    onClick={() => setSelectedPreset(preset)}
                    className={`relative px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={config.description}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="selectedPreset"
                        className="absolute inset-0 bg-primary-600 rounded-lg"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                      </svg>
                      <span>{config.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {recommendations.recommended && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5"
              >
                <svg className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {PRESET_CONFIG[selectedPreset].label} format is automatically recommended. Look for the <span className="font-semibold text-primary-700 dark:text-primary-300">Recommended</span> badge.
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab Content */}
      <div className="space-y-3 sm:space-y-4">
        {/* Video Formats */}
        {((videoFormats.length > 0 && audioFormats.length === 0) || (activeTab === 'video' && videoFormats.length > 0)) && (
          <motion.div
            key="video"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {videoFormats.map((format, index) => (
              <motion.div
                key={format.format_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                {renderFormatCard(format)}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Audio Formats */}
        {((audioFormats.length > 0 && videoFormats.length === 0) || (activeTab === 'audio' && audioFormats.length > 0)) && (
          <motion.div
            key="audio"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {audioFormats.map((format, index) => (
              <motion.div
                key={format.format_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                {renderFormatCard(format)}
              </motion.div>
            ))}
          </motion.div>
        )}

        {formats.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 text-center py-12"
          >
            No formats available
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
