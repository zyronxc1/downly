import { spawn, ChildProcess } from 'child_process';
import { Readable, PassThrough } from 'stream';
import { isValidUrl } from '../utils/urlValidator';

/**
 * Supported conversion formats
 */
export type ConversionFormat = 'mp3' | 'mp4' | 'webm' | 'aac';

/**
 * Service for media conversion using FFmpeg
 * Handles video to audio conversion and container conversion
 */
export class ConversionService {
  private readonly ytDlpPath: string;
  private readonly ffmpegPath: string;
  private readonly defaultTimeout: number;

  constructor() {
    this.ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp';
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    // Default timeout: 15 minutes for conversions
    this.defaultTimeout = parseInt(process.env.CONVERSION_TIMEOUT || '900000', 10);
  }

  /**
   * Validates if a target format is supported
   */
  isValidFormat(format: string): format is ConversionFormat {
    return ['mp3', 'mp4', 'webm', 'aac'].includes(format.toLowerCase());
  }

  /**
   * Gets FFmpeg arguments for conversion
   */
  private getFfmpegArgs(targetFormat: ConversionFormat): string[] {
    const format = targetFormat.toLowerCase();
    
    switch (format) {
      case 'mp3':
        // Convert video to MP3 audio
        return [
          '-i', 'pipe:0', // Input from stdin
          '-vn', // No video
          '-acodec', 'libmp3lame', // MP3 encoder
          '-ab', '192k', // Audio bitrate
          '-ar', '44100', // Sample rate
          '-f', 'mp3', // Output format
          'pipe:1', // Output to stdout
        ];
      
      case 'aac':
        // Convert video to AAC audio
        return [
          '-i', 'pipe:0', // Input from stdin
          '-vn', // No video
          '-acodec', 'aac', // AAC encoder
          '-ab', '192k', // Audio bitrate
          '-ar', '44100', // Sample rate
          '-f', 'adts', // ADTS format for AAC
          'pipe:1', // Output to stdout
        ];
      
      case 'mp4':
        // Convert/remux to MP4 container
        return [
          '-i', 'pipe:0', // Input from stdin
          '-c', 'copy', // Copy codecs (fast, no re-encoding)
          '-f', 'mp4', // Output format
          '-movflags', 'frag_keyframe+empty_moov', // Enable streaming
          'pipe:1', // Output to stdout
        ];
      
      case 'webm':
        // Convert/remux to WebM container
        return [
          '-i', 'pipe:0', // Input from stdin
          '-c', 'copy', // Copy codecs (fast, no re-encoding)
          '-f', 'webm', // Output format
          'pipe:1', // Output to stdout
        ];
      
      default:
        throw new Error(`Unsupported conversion format: ${targetFormat}`);
    }
  }

  /**
   * Gets content type based on format
   */
  getContentType(format: ConversionFormat): string {
    const formatLower = format.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'aac': 'audio/aac',
    };
    return contentTypeMap[formatLower] || 'application/octet-stream';
  }

  /**
   * Gets file extension based on format
   */
  getFileExtension(format: ConversionFormat): string {
    return format.toLowerCase();
  }

  /**
   * Converts media using yt-dlp and FFmpeg with piped streams
   * Streams converted output without using temporary files
   * Prevents memory overload by using streams
   */
  convertMedia(
    url: string,
    targetFormat: ConversionFormat,
    timeout: number = this.defaultTimeout
  ): { process: ChildProcess; stream: Readable; cleanup: () => void } {
    // Security: Validate URL to prevent open proxy behavior
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    // Additional security: Ensure URL is HTTP/HTTPS
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error('Only HTTP/HTTPS URLs are allowed');
      }
    } catch (error) {
      throw new Error('Invalid URL');
    }

    // Validate format
    if (!this.isValidFormat(targetFormat)) {
      throw new Error(`Unsupported conversion format: ${targetFormat}`);
    }

    // Build yt-dlp command arguments (best quality, output to stdout)
    const ytDlpArgs = [
      '-f', 'best', // Best quality format
      '--no-playlist', // Only download single video
      '--no-warnings', // Suppress warnings
      '--no-call-home', // Don't call home
      '-o', '-', // Output to stdout for streaming
      url,
    ];

    // Build FFmpeg command arguments
    const ffmpegArgs = this.getFfmpegArgs(targetFormat);

    // Spawn yt-dlp process with proper stdio configuration
    const ytDlpProcess = spawn(this.ytDlpPath, ytDlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore, stdout: pipe, stderr: pipe
    });

    if (!ytDlpProcess.stdout) {
      throw new Error('yt-dlp stdout stream is not available');
    }

    // Spawn FFmpeg process with proper stdio configuration
    const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'], // stdin: pipe, stdout: pipe, stderr: pipe
    });
    
    // Track if processes have been cleaned up
    let isCleanedUp = false;

    if (!ffmpegProcess.stdin || !ffmpegProcess.stdout) {
      throw new Error('FFmpeg streams are not available');
    }

    // Pipe yt-dlp stdout to FFmpeg stdin (this is the key - no temp files!)
    ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);

    // Create a pass-through stream for FFmpeg stdout
    const outputStream = ffmpegProcess.stdout;

    // Handle yt-dlp stderr
    ytDlpProcess.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      if (!errorMsg.includes('WARNING') && !errorMsg.includes('DeprecationWarning')) {
        console.error('yt-dlp stderr:', errorMsg);
      }
    });

    // Handle FFmpeg stderr (FFmpeg outputs progress to stderr)
    ffmpegProcess.stderr?.on('data', (data) => {
      // FFmpeg outputs progress to stderr, but we don't need to log it
      // Only log actual errors
      const errorMsg = data.toString();
      if (errorMsg.includes('Error') || errorMsg.includes('error')) {
        console.error('FFmpeg stderr:', errorMsg);
      }
    });

    // Handle yt-dlp spawn errors (process failed to start)
    ytDlpProcess.on('error', (error) => {
      if (isCleanedUp) return;
      
      const errorMsg = error.message.includes('ENOENT')
        ? 'yt-dlp not found. Please install yt-dlp.'
        : `yt-dlp process error: ${error.message}`;
      
      if (!outputStream.destroyed) {
        outputStream.destroy(new Error(errorMsg));
      }
      
      // Kill FFmpeg if yt-dlp fails to start
      if (!ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGTERM');
      }
      
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    // Handle FFmpeg spawn errors (process failed to start)
    ffmpegProcess.on('error', (error) => {
      if (isCleanedUp) return;
      
      const errorMsg = error.message.includes('ENOENT')
        ? 'FFmpeg not found. Please install FFmpeg.'
        : `FFmpeg process error: ${error.message}`;
      
      if (!outputStream.destroyed) {
        outputStream.destroy(new Error(errorMsg));
      }
      
      // Kill yt-dlp if FFmpeg fails to start
      if (!ytDlpProcess.killed) {
        ytDlpProcess.kill('SIGTERM');
      }
      
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    // Handle yt-dlp process exit
    ytDlpProcess.on('exit', (code, signal) => {
      if (isCleanedUp) return;
      
      // Check exit code
      if (code !== 0 && code !== null) {
        const errorMsg = signal
          ? `yt-dlp process killed by signal ${signal}`
          : `yt-dlp process exited with code ${code}`;
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error(errorMsg));
        }
      }
      
      // Close FFmpeg stdin when yt-dlp finishes (normal or error)
      if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.end();
      }
    });

    // 🔥 CRITICAL: yt-dlp MUST emit close event
    // Do NOT rely on exit alone - close is more reliable
    ytDlpProcess.on('close', (code, signal) => {
      if (isCleanedUp) return;
      
      // Check exit code
      if (code !== 0 && code !== null) {
        const errorMsg = signal
          ? `yt-dlp process killed by signal ${signal}`
          : `yt-dlp process closed with code ${code}`;
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error(errorMsg));
        }
      }
      
      // Ensure FFmpeg stdin is closed when yt-dlp closes
      if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.end();
      }
    });

    // Handle FFmpeg process exit
    ffmpegProcess.on('exit', (code, signal) => {
      if (isCleanedUp) return;
      
      // Check exit code (255 might be normal for some FFmpeg operations)
      if (code !== 0 && code !== null && code !== 255) {
        const errorMsg = signal
          ? `FFmpeg process killed by signal ${signal}`
          : `FFmpeg process exited with code ${code}`;
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error(errorMsg));
        }
      }
    });

    // 🔥 CRITICAL: FFmpeg MUST emit close event
    // Do NOT rely on exit alone - close is more reliable
    ffmpegProcess.on('close', (code, signal) => {
      if (isCleanedUp) return;
      
      // Clear timeout when FFmpeg closes
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Check exit code (255 might be normal for some FFmpeg operations)
      if (code !== 0 && code !== null && code !== 255) {
        const errorMsg = signal
          ? `FFmpeg process killed by signal ${signal}`
          : `FFmpeg process closed with code ${code}`;
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error(errorMsg));
        }
      }
    });

    // Timeout protection
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      if (!ytDlpProcess.killed) {
        ytDlpProcess.kill('SIGTERM');
      }
      if (!ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGTERM');
      }
      outputStream.destroy(new Error('Conversion timeout'));
    }, timeout);

    // Cleanup function
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Kill processes if still running
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
      
      if (ffmpegProcess && !ffmpegProcess.killed && ffmpegProcess.exitCode === null) {
        // Try graceful shutdown first
        ffmpegProcess.kill('SIGTERM');
        
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (ffmpegProcess && !ffmpegProcess.killed && ffmpegProcess.exitCode === null) {
            ffmpegProcess.kill('SIGKILL');
          }
        }, 2000);
      }
      
      // Close pipes
      if (ytDlpProcess.stdout && !ytDlpProcess.stdout.destroyed) {
        ytDlpProcess.stdout.destroy();
      }
      // Close FFmpeg stdin if still open
      if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.destroy();
      }
      if (ffmpegProcess.stdout && !ffmpegProcess.stdout.destroyed) {
        ffmpegProcess.stdout.destroy();
      }
    };

    // Clear timeout when stream ends
    outputStream.on('end', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    });

    outputStream.on('close', () => {
      cleanup();
    });

    return {
      process: ffmpegProcess, // Return FFmpeg process as main process
      stream: outputStream,
      cleanup,
    };
  }

  /**
   * Gets filename for converted media
   */
  async getConvertedFilename(url: string, targetFormat: ConversionFormat): Promise<string> {
    try {
      // Import YtDlpService for metadata extraction
      const { YtDlpService } = await import('./ytdlpService');
      const ytDlpService = new YtDlpService();

      const info = await ytDlpService.analyzeUrl(url);
      const sanitizedTitle = this.sanitizeFilename(info.title);
      const extension = this.getFileExtension(targetFormat);
      
      return `${sanitizedTitle}.${extension}`;
    } catch (error) {
      // Fallback if metadata extraction fails
      const extension = this.getFileExtension(targetFormat);
      return `converted.${extension}`;
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
}

