import { AnalyzeResponse } from '../types/api';
/**
 * Service for interacting with yt-dlp
 * Handles metadata extraction from media URLs
 */
export declare class YtDlpService {
    private readonly ytDlpPath;
    constructor();
    /**
     * Extracts metadata from a media URL without downloading
     * Returns normalized data matching the API contract
     */
    analyzeUrl(url: string): Promise<AnalyzeResponse>;
    /**
     * Normalizes yt-dlp output to match API contract
     * Separates audio/video formats, removes duplicates and unusable formats
     */
    private normalizeResponse;
    /**
     * Normalizes container type to standard formats
     */
    private normalizeContainerType;
    /**
     * Normalizes resolution to consistent format
     */
    private normalizeResolution;
    /**
     * Normalizes file size with consistent formatting
     */
    private normalizeFileSize;
    /**
     * Extracts numeric value from resolution string for sorting
     */
    private extractResolutionValue;
    /**
     * Formats file size in bytes to human-readable format
     */
    private formatFileSize;
    /**
     * Formats duration in seconds to HH:MM:SS or MM:SS format
     */
    private formatDuration;
}
//# sourceMappingURL=ytdlpService.d.ts.map