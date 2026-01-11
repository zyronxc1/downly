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
  process?: any; // ChildProcess reference for cancellation
  stream?: any; // Stream reference for cancellation
}

/**
 * Service for tracking download progress
 * Emits progress updates that can be consumed via SSE
 */
export class ProgressService extends EventEmitter {
  private sessions: Map<string, DownloadSession> = new Map();
  private readonly sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    // Clean up old sessions periodically
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Creates a new download session and returns the download ID
   * If downloadId is provided, uses it; otherwise generates a new one
   */
  createSession(url: string, formatId: string, downloadId?: string): string {
    const id = downloadId || this.generateDownloadId();
    
    // Don't overwrite existing session
    if (this.sessions.has(id)) {
      return id;
    }
    
    const session: DownloadSession = {
      downloadId: id,
      url,
      formatId,
      progress: {
        downloadId: id,
        bytesDownloaded: 0,
        totalBytes: null,
        percentage: null,
        status: 'downloading',
      },
      createdAt: new Date(),
    };

    this.sessions.set(id, session);
    return id;
  }

  /**
   * Gets a download session by ID
   */
  getSession(downloadId: string): DownloadSession | undefined {
    return this.sessions.get(downloadId);
  }

  /**
   * Updates progress for a download session
   */
  updateProgress(
    downloadId: string,
    bytesDownloaded: number,
    totalBytes: number | null = null
  ): void {
    const session = this.sessions.get(downloadId);
    if (!session) {
      return;
    }

    const percentage = totalBytes ? Math.round((bytesDownloaded / totalBytes) * 100) : null;

    session.progress = {
      downloadId,
      bytesDownloaded,
      totalBytes,
      percentage,
      status: 'downloading',
    };

    // Emit progress update event
    this.emit('progress', session.progress);
  }

  /**
   * Marks a download as completed
   */
  markCompleted(downloadId: string): void {
    const session = this.sessions.get(downloadId);
    if (!session) {
      return;
    }

    session.progress = {
      ...session.progress,
      status: 'completed',
      percentage: 100,
    };

    // Emit completion event
    this.emit('progress', session.progress);
  }

  /**
   * Marks a download as error
   */
  markError(downloadId: string, error: string): void {
    const session = this.sessions.get(downloadId);
    if (!session) {
      return;
    }

    session.progress = {
      ...session.progress,
      status: 'error',
      error,
    };

    // Emit error event
    this.emit('progress', session.progress);
  }

  /**
   * Cancels a download session
   */
  cancelDownload(downloadId: string): boolean {
    const session = this.sessions.get(downloadId);
    if (!session) {
      return false;
    }

    // Kill the process if it exists
    if (session.process && !session.process.killed && session.process.exitCode === null) {
      // Try graceful shutdown first
      session.process.kill('SIGTERM');
      
      // Force kill after 2 seconds if still running
      setTimeout(() => {
        if (session.process && !session.process.killed && session.process.exitCode === null) {
          session.process.kill('SIGKILL');
        }
      }, 2000);
    }

    // Destroy the stream if it exists
    if (session.stream && !session.stream.destroyed) {
      session.stream.destroy();
    }

    session.progress = {
      ...session.progress,
      status: 'cancelled',
    };

    // Emit cancellation event
    this.emit('progress', session.progress);

    // Clean up session after a delay
    setTimeout(() => {
      this.sessions.delete(downloadId);
    }, 5000);

    return true;
  }

  /**
   * Stores process and stream references for cancellation
   */
  setSessionReferences(downloadId: string, process: any, stream: any): void {
    const session = this.sessions.get(downloadId);
    if (session) {
      session.process = process;
      session.stream = stream;
    }
  }

  /**
   * Generates a unique download ID
   */
  private generateDownloadId(): string {
    return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Cleans up old sessions that have timed out
   */
  private cleanupSessions(): void {
    const now = Date.now();
    for (const [downloadId, session] of this.sessions.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > this.sessionTimeout) {
        // Only clean up completed, error, or cancelled sessions
        if (
          session.progress.status === 'completed' ||
          session.progress.status === 'error' ||
          session.progress.status === 'cancelled'
        ) {
          this.sessions.delete(downloadId);
        }
      }
    }
  }

  /**
   * Gets current progress for a download
   */
  getProgress(downloadId: string): DownloadProgress | null {
    const session = this.sessions.get(downloadId);
    return session?.progress || null;
  }
}

// Export singleton instance
export const progressService = new ProgressService();

