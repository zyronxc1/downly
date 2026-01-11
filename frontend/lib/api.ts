import axios from 'axios';

/**
 * Get API base URL from environment variable
 * Falls back to localhost only in development mode
 */
function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // If environment variable is set, use it
  if (envUrl) {
    return envUrl;
  }
  
  // Only fallback to localhost in development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }
  
  // In production, throw an error if API URL is not configured
  if (typeof window !== 'undefined') {
    console.error(
      'NEXT_PUBLIC_API_URL is not set. Please configure the API URL in your environment variables.'
    );
  }
  
  // Return empty string as fallback (will cause API calls to fail gracefully)
  return '';
}

// API base URL - uses NEXT_PUBLIC_API_URL or falls back to localhost in development
export const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Get proxied image URL to bypass CORS restrictions
 * @param imageUrl The original image URL
 * @returns Proxied image URL
 */
export function getProxiedImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  return `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(imageUrl)}`;
}

export interface AnalyzeRequest {
  url: string;
}

export interface FormatInfo {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: string;
  type: 'audio' | 'video';
}

export interface AnalyzeResponse {
  title: string;
  thumbnail: string;
  duration: string;
  formats: FormatInfo[];
}

export interface BatchAnalyzeItemResult {
  url: string;
  success: boolean;
  data?: AnalyzeResponse;
  error?: string;
}

export interface BatchAnalyzeResponse {
  results: BatchAnalyzeItemResult[];
  total: number;
  successful: number;
  failed: number;
}

/**
 * Analyzes a media URL and returns metadata
 */
export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
  const response = await apiClient.post<AnalyzeResponse>('/api/analyze', {
    url,
  } as AnalyzeRequest);
  return response.data;
}

/**
 * Analyzes multiple media URLs in parallel and returns grouped results
 */
export async function analyzeBatch(urls: string[]): Promise<BatchAnalyzeResponse> {
  const response = await apiClient.post<BatchAnalyzeResponse>('/api/analyze/batch', {
    urls,
  });
  return response.data;
}

/**
 * Downloads media file using format_id
 * Returns blob URL for download
 */
export function getDownloadUrl(url: string, formatId: string): string {
  const params = new URLSearchParams({
    url,
    format_id: formatId,
  });
  return `${API_BASE_URL}/api/download?${params.toString()}`;
}

/**
 * Converts media to target format
 * Returns blob URL for download
 */
export function getConvertUrl(url: string, targetFormat: string): string {
  return `${API_BASE_URL}/api/convert`;
}

/**
 * Progress data interface matching backend
 */
export interface DownloadProgress {
  downloadId: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  percentage: number | null;
  status: 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

/**
 * Downloads media file and returns downloadId from response headers
 * Note: This function streams the download and returns the blob when complete
 */
export async function downloadMedia(
  url: string,
  formatId: string
): Promise<{ downloadId: string; blob: Blob }> {
  const downloadUrl = getDownloadUrl(url, formatId);
  
  const response = await fetch(downloadUrl);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Download failed');
  }

  // Get downloadId from response headers (available immediately)
  const downloadId = response.headers.get('X-Download-Id') || '';
  
  if (!downloadId) {
    throw new Error('Download ID not received from server');
  }
  
  // Convert response to blob (this will stream the download)
  const blob = await response.blob();
  
  return { downloadId, blob };
}

/**
 * Gets the progress SSE endpoint URL
 */
export function getProgressUrl(downloadId: string): string {
  return `${API_BASE_URL}/api/progress/${downloadId}`;
}

/**
 * Cancels a download
 */
export async function cancelDownload(downloadId: string): Promise<void> {
  await apiClient.post(`/api/download/${downloadId}/cancel`);
}

/**
 * Queue job types and status
 */
export type JobType = 'download' | 'convert';
export type JobStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'failed';

export interface QueueJob {
  id: string;
  type: JobType;
  url: string;
  formatId?: string;
  targetFormat?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  downloadId?: string;
  progress?: {
    bytesDownloaded: number;
    totalBytes: number | null;
    percentage: number | null;
  };
}

export interface QueueState {
  jobs: QueueJob[];
  queue: string[];
  processing: string | null;
  queuedCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
}

/**
 * Adds a download job to the queue
 */
export async function addDownloadJob(url: string, formatId: string): Promise<{ jobId: string; canStart: boolean }> {
  const response = await apiClient.post<{ jobId: string; canStart: boolean }>('/api/queue/download', {
    url,
    format_id: formatId,
  });
  return response.data;
}

/**
 * Adds a conversion job to the queue
 */
export async function addConvertJob(url: string, targetFormat: string): Promise<{ jobId: string; canStart: boolean }> {
  const response = await apiClient.post<{ jobId: string; canStart: boolean }>('/api/queue/convert', {
    url,
    target_format: targetFormat,
  });
  return response.data;
}

/**
 * Gets the current queue state
 */
export async function getQueueState(): Promise<QueueState> {
  const response = await apiClient.get<QueueState>('/api/queue');
  return response.data;
}

/**
 * Gets a specific job by ID
 */
export async function getJob(jobId: string): Promise<QueueJob> {
  const response = await apiClient.get<QueueJob>(`/api/queue/${jobId}`);
  return response.data;
}

/**
 * Cancels a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  await apiClient.post(`/api/queue/${jobId}/cancel`);
}

/**
 * Downloads media file using job ID from queue
 */
export async function downloadMediaWithJob(jobId: string): Promise<{ downloadId: string; blob: Blob }> {
  const downloadUrl = `${API_BASE_URL}/api/download?jobId=${encodeURIComponent(jobId)}`;
  
  const response = await fetch(downloadUrl);
  
  if (!response.ok) {
    // Check if it's a 202 (queued) response
    if (response.status === 202) {
      const data = await response.json();
      throw new Error(data.message || 'Job is queued');
    }
    // Check if it's a 409 (conflict - job can't start yet)
    if (response.status === 409) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Job cannot start yet. Please wait and try again.');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Download failed');
  }

  // Get downloadId from response headers
  const downloadId = response.headers.get('X-Download-Id') || response.headers.get('x-download-id') || '';
  
  // If no downloadId in headers, try to use jobId as fallback
  // (the progress service might use jobId as downloadId)
  const finalDownloadId = downloadId || jobId;
  
  if (!finalDownloadId) {
    throw new Error('Download ID not received from server');
  }
  
  // Convert response to blob
  const blob = await response.blob();
  
  return { downloadId: finalDownloadId, blob };
}

/**
 * Converts media using job ID from queue
 */
export async function convertMediaWithJob(jobId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  });
  
  if (!response.ok) {
    // Check if it's a 202 (queued) response
    if (response.status === 202) {
      const data = await response.json();
      throw new Error(data.message || 'Job is queued');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Conversion failed');
  }
  
  return await response.blob();
}

