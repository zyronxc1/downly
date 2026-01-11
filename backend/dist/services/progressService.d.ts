import { EventEmitter } from 'events';
export interface DownloadProgress {
    downloadId: string;
    bytesDownloaded: number;
    totalBytes: number | null;
    percentage: number | null;
    status: 'downloading' | 'completed' | 'error' | 'cancelled';
    error?: string;
}
export interface DownloadSession {
    downloadId: string;
    url: string;
    formatId: string;
    progress: DownloadProgress;
    createdAt: Date;
    process?: any;
    stream?: any;
}
/**
 * Service for tracking download progress
 * Emits progress updates that can be consumed via SSE
 */
export declare class ProgressService extends EventEmitter {
    private sessions;
    private readonly sessionTimeout;
    constructor();
    /**
     * Creates a new download session and returns the download ID
     * If downloadId is provided, uses it; otherwise generates a new one
     */
    createSession(url: string, formatId: string, downloadId?: string): string;
    /**
     * Gets a download session by ID
     */
    getSession(downloadId: string): DownloadSession | undefined;
    /**
     * Updates progress for a download session
     */
    updateProgress(downloadId: string, bytesDownloaded: number, totalBytes?: number | null): void;
    /**
     * Marks a download as completed
     */
    markCompleted(downloadId: string): void;
    /**
     * Marks a download as error
     */
    markError(downloadId: string, error: string): void;
    /**
     * Cancels a download session
     */
    cancelDownload(downloadId: string): boolean;
    /**
     * Stores process and stream references for cancellation
     */
    setSessionReferences(downloadId: string, process: any, stream: any): void;
    /**
     * Generates a unique download ID
     */
    private generateDownloadId;
    /**
     * Cleans up old sessions that have timed out
     */
    private cleanupSessions;
    /**
     * Gets current progress for a download
     */
    getProgress(downloadId: string): DownloadProgress | null;
}
export declare const progressService: ProgressService;
//# sourceMappingURL=progressService.d.ts.map