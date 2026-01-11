import { spawn, ChildProcess } from 'child_process';
import { Readable, Transform } from 'stream';
import { isValidUrl } from '../utils/urlValidator';
import { progressService } from './progressService';

/**
 * Service for streaming media downloads
 * Handles yt-dlp streaming with proper security measures
 */
export class DownloadService {
  private readonly ytDlpPath: string;
  private readonly defaultTimeout: number;

  constructor() {
    this.ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp';
    // Default timeout: 10 minutes for downloads
    this.defaultTimeout = parseInt(process.env.DOWNLOAD_TIMEOUT || '600000', 10);
  }

  /**
   * Streams media download from yt-dlp with progress tracking
   * Returns the process object and stdout stream for handling
   * Prevents open proxy behavior by validating URLs
   */
  streamDownload(
    url: string,
    formatId: string,
    downloadId: string,
    timeout: number = this.defaultTimeout
  ): { process: ChildProcess; stream: Readable; cleanup: () => void } {
    // Security: Validate URL to prevent open proxy behavior
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Additional security: Ensure URL is HTTP/HTTPS (not file://, ftp://, etc.)
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Only HTTP/HTTPS URLs are allowed');
      }
    } catch (error) {
      throw new Error('Invalid URL');
    }

    // Build yt-dlp command arguments
    const args = [
      '-f', formatId, // Select format
      '--no-playlist', // Only download single video
      '--no-warnings', // Suppress warnings
      '--no-call-home', // Don't call home
      '--prefer-free-formats', // Prefer free formats
      '-o', '-', // Output to stdout for streaming
      url,
    ];

    // Spawn yt-dlp process with proper stdio configuration
    const ytDlpProcess = spawn(this.ytDlpPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout: pipe, stderr: pipe
    });

    // Get stdout stream
    if (!ytDlpProcess.stdout) {
      throw new Error('yt-dlp stdout stream is not available');
    }

    const stdoutStream = ytDlpProcess.stdout;
    
    // Track if process has been cleaned up
    let isCleanedUp = false;

    // Create a transform stream to track bytes downloaded
    let bytesDownloaded = 0;
    const progressStream = new Transform({
      transform(chunk: Buffer, encoding, callback) {
        bytesDownloaded += chunk.length;
        // Update progress every 64KB or when chunk is larger
        if (bytesDownloaded % 65536 === 0 || chunk.length >= 65536) {
          progressService.updateProgress(downloadId, bytesDownloaded);
        }
        callback(null, chunk);
      },
      flush(callback) {
        // Final update
        progressService.updateProgress(downloadId, bytesDownloaded);
        progressService.markCompleted(downloadId);
        callback();
      },
    });

    // Pipe stdout through progress tracker
    const stream = stdoutStream.pipe(progressStream);

    // Store references for cancellation
    progressService.setSessionReferences(downloadId, ytDlpProcess, stream);

    // Handle stderr for progress info (yt-dlp may output progress here)
    ytDlpProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      
      // Try to extract total bytes from yt-dlp progress output
      // yt-dlp format: [download] XX.X% of YYY.XXMiB at ZZZ.XXMiB/s ETA MM:SS
      const progressMatch = errorMsg.match(/\[download\]\s+\d+\.?\d*%\s+of\s+(\d+\.?\d*)\s*(MiB|GiB|KiB)/i);
      if (progressMatch) {
        const totalStr = progressMatch[1];
        const unit = progressMatch[2].toUpperCase();
        let totalBytes = parseFloat(totalStr);
        
        // Convert to bytes
        if (unit === 'KIB') totalBytes *= 1024;
        else if (unit === 'MIB') totalBytes *= 1024 * 1024;
        else if (unit === 'GIB') totalBytes *= 1024 * 1024 * 1024;
        
        if (!isNaN(totalBytes)) {
          progressService.updateProgress(downloadId, bytesDownloaded, Math.round(totalBytes));
        }
      }
      
      // Log non-warning errors
      if (!errorMsg.includes('WARNING') && !errorMsg.includes('DeprecationWarning') && !errorMsg.includes('[download]')) {
        console.error('yt-dlp stderr:', errorMsg);
      }
    });

    // Handle spawn errors (process failed to start)
    ytDlpProcess.on('error', (error) => {
      if (isCleanedUp) return;
      
      const errorMsg = error.message.includes('ENOENT') 
        ? 'yt-dlp not found. Please install yt-dlp.' 
        : `yt-dlp process error: ${error.message}`;
      
      progressService.markError(downloadId, errorMsg);
      stream.destroy(new Error(errorMsg));
      
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    // Timeout protection
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      if (!ytDlpProcess.killed) {
        const errorMsg = 'Download timeout';
        progressService.markError(downloadId, errorMsg);
        ytDlpProcess.kill('SIGTERM');
        stream.destroy(new Error(errorMsg));
      }
    }, timeout);

    // Cleanup function
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Kill process if still running
      if (ytDlpProcess && !ytDlpProcess.killed && ytDlpProcess.exitCode === null) {
        // Try graceful shutdown first
        ytDlpProcess.kill('SIGTERM');
        
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (ytDlpProcess && !ytDlpProcess.killed && ytDlpProcess.exitCode === null) {
            ytDlpProcess.kill('SIGKILL');
          }
        }, 2000);
      }
    };

    // Handle process exit
    ytDlpProcess.on('exit', (code, signal) => {
      if (isCleanedUp) return;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Check exit code
      if (code !== 0 && code !== null) {
        const errorMsg = signal 
          ? `yt-dlp process killed by signal ${signal}` 
          : `yt-dlp process exited with code ${code}`;
        progressService.markError(downloadId, errorMsg);
        if (!stream.destroyed) {
          stream.destroy(new Error(errorMsg));
        }
      } else if (code === 0) {
        // Process completed successfully
        progressService.markCompleted(downloadId);
      }
    });

    // 🔥 CRITICAL: yt-dlp MUST emit close event
    // Do NOT rely on exit alone - close is more reliable
    ytDlpProcess.on('close', (code, signal) => {
      if (isCleanedUp) return;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Check exit code
      if (code !== 0 && code !== null) {
        const errorMsg = signal 
          ? `yt-dlp process killed by signal ${signal}` 
          : `yt-dlp process closed with code ${code}`;
        progressService.markError(downloadId, errorMsg);
        if (!stream.destroyed) {
          stream.destroy(new Error(errorMsg));
        }
      } else if (code === 0) {
        // Process completed successfully
        progressService.markCompleted(downloadId);
      }
    });

    return {
      process: ytDlpProcess,
      stream,
      cleanup,
    };
  }

  /**
   * Gets filename and content type for a media URL and format
   * Used for setting proper download headers
   */
  async getDownloadInfo(url: string, formatId: string): Promise<{
    filename: string;
    contentType: string;
    extension: string;
  }> {
    // Import YtDlpService for metadata extraction
    const { YtDlpService } = await import('./ytdlpService');
    const ytDlpService = new YtDlpService();

    try {
      // Get metadata to extract filename and extension
      const info = await ytDlpService.analyzeUrl(url);
      
      // Find the format
      const format = info.formats.find(f => f.format_id === formatId);
      if (!format) {
        throw new Error('Format not found');
      }

      // Sanitize title for filename
      const sanitizedTitle = this.sanitizeFilename(info.title);
      const extension = format.ext || 'mp4';
      const filename = `${sanitizedTitle}.${extension}`;

      // Determine content type
      const contentType = this.getContentType(extension);

      return {
        filename,
        contentType,
        extension,
      };
    } catch (error) {
      // Fallback if metadata extraction fails
      const extension = 'mp4';
      return {
        filename: `download.${extension}`,
        contentType: this.getContentType(extension),
        extension,
      };
    }
  }

  /**
   * Sanitizes filename to be safe for filesystem and HTTP headers
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
      .replace(/\s+/g, '_') // Replace spaces
      .substring(0, 200); // Limit length
  }

  /**
   * Gets content type based on file extension
   */
  private getContentType(ext: string): string {
    const contentTypeMap: Record<string, string> = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'opus': 'audio/opus',
      'flac': 'audio/flac',
    };

    return contentTypeMap[ext.toLowerCase()] || 'application/octet-stream';
  }
}

