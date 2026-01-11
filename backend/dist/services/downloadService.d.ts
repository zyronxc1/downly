import { ChildProcess } from 'child_process';
import { Readable } from 'stream';
/**
 * Service for streaming media downloads
 * Handles yt-dlp streaming with proper security measures
 */
export declare class DownloadService {
    private readonly ytDlpPath;
    private readonly defaultTimeout;
    constructor();
    /**
     * Streams media download from yt-dlp with progress tracking
     * Returns the process object and stdout stream for handling
     * Prevents open proxy behavior by validating URLs
     */
    streamDownload(url: string, formatId: string, downloadId: string, timeout?: number): {
        process: ChildProcess;
        stream: Readable;
        cleanup: () => void;
    };
    /**
     * Gets filename and content type for a media URL and format
     * Used for setting proper download headers
     */
    getDownloadInfo(url: string, formatId: string): Promise<{
        filename: string;
        contentType: string;
        extension: string;
    }>;
    /**
     * Sanitizes filename to be safe for filesystem and HTTP headers
     */
    private sanitizeFilename;
    /**
     * Gets content type based on file extension
     */
    private getContentType;
}
//# sourceMappingURL=downloadService.d.ts.map