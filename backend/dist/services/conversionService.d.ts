import { ChildProcess } from 'child_process';
import { Readable } from 'stream';
/**
 * Supported conversion formats
 */
export type ConversionFormat = 'mp3' | 'mp4' | 'webm' | 'aac';
/**
 * Service for media conversion using FFmpeg
 * Handles video to audio conversion and container conversion
 */
export declare class ConversionService {
    private readonly ytDlpPath;
    private readonly ffmpegPath;
    private readonly defaultTimeout;
    constructor();
    /**
     * Validates if a target format is supported
     */
    isValidFormat(format: string): format is ConversionFormat;
    /**
     * Gets FFmpeg arguments for conversion
     */
    private getFfmpegArgs;
    /**
     * Gets content type based on format
     */
    getContentType(format: ConversionFormat): string;
    /**
     * Gets file extension based on format
     */
    getFileExtension(format: ConversionFormat): string;
    /**
     * Converts media using yt-dlp and FFmpeg with piped streams
     * Streams converted output without using temporary files
     * Prevents memory overload by using streams
     */
    convertMedia(url: string, targetFormat: ConversionFormat, timeout?: number): {
        process: ChildProcess;
        stream: Readable;
        cleanup: () => void;
    };
    /**
     * Gets filename for converted media
     */
    getConvertedFilename(url: string, targetFormat: ConversionFormat): Promise<string>;
    /**
     * Sanitizes filename to be safe for filesystem and HTTP headers
     */
    private sanitizeFilename;
}
//# sourceMappingURL=conversionService.d.ts.map