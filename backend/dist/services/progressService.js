"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressService = exports.ProgressService = void 0;
const events_1 = require("events");
/**
 * Service for tracking download progress
 * Emits progress updates that can be consumed via SSE
 */
class ProgressService extends events_1.EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        // Clean up old sessions periodically
        setInterval(() => this.cleanupSessions(), 5 * 60 * 1000); // Every 5 minutes
    }
    /**
     * Creates a new download session and returns the download ID
     * If downloadId is provided, uses it; otherwise generates a new one
     */
    createSession(url, formatId, downloadId) {
        const id = downloadId || this.generateDownloadId();
        // Don't overwrite existing session
        if (this.sessions.has(id)) {
            return id;
        }
        const session = {
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
    getSession(downloadId) {
        return this.sessions.get(downloadId);
    }
    /**
     * Updates progress for a download session
     */
    updateProgress(downloadId, bytesDownloaded, totalBytes = null) {
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
    markCompleted(downloadId) {
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
    markError(downloadId, error) {
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
    cancelDownload(downloadId) {
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
    setSessionReferences(downloadId, process, stream) {
        const session = this.sessions.get(downloadId);
        if (session) {
            session.process = process;
            session.stream = stream;
        }
    }
    /**
     * Generates a unique download ID
     */
    generateDownloadId() {
        return `dl_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
    /**
     * Cleans up old sessions that have timed out
     */
    cleanupSessions() {
        const now = Date.now();
        for (const [downloadId, session] of this.sessions.entries()) {
            const age = now - session.createdAt.getTime();
            if (age > this.sessionTimeout) {
                // Only clean up completed, error, or cancelled sessions
                if (session.progress.status === 'completed' ||
                    session.progress.status === 'error' ||
                    session.progress.status === 'cancelled') {
                    this.sessions.delete(downloadId);
                }
            }
        }
    }
    /**
     * Gets current progress for a download
     */
    getProgress(downloadId) {
        const session = this.sessions.get(downloadId);
        return session?.progress || null;
    }
}
exports.ProgressService = ProgressService;
// Export singleton instance
exports.progressService = new ProgressService();
//# sourceMappingURL=progressService.js.map