"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YtDlpService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * Service for interacting with yt-dlp
 * Handles metadata extraction from media URLs
 */
class YtDlpService {
    constructor() {
        // Default to 'yt-dlp' command (should be in PATH)
        // Can be overridden via YT_DLP_PATH environment variable
        this.ytDlpPath = process.env.YT_DLP_PATH || 'yt-dlp';
    }
    /**
     * Extracts metadata from a media URL without downloading
     * Returns normalized data matching the API contract
     */
    async analyzeUrl(url) {
        try {
            // Run yt-dlp with --dump-json to get metadata only (no download)
            const { stdout, stderr } = await execFileAsync(this.ytDlpPath, [
                '--dump-json',
                '--no-warnings',
                '--no-playlist',
                url,
            ], {
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                timeout: 30000, // 30 second timeout
            });
            if (stderr && !stderr.includes('WARNING')) {
                console.warn('yt-dlp stderr:', stderr);
            }
            const info = JSON.parse(stdout);
            return this.normalizeResponse(info);
        }
        catch (error) {
            // Handle common yt-dlp errors
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('ENOENT')) {
                    throw new Error('yt-dlp not found. Please install yt-dlp.');
                }
                if (error.message.includes('Unsupported URL') || error.message.includes('HTTP Error')) {
                    throw new Error('Invalid or unsupported URL');
                }
                if (error.message.includes('timeout')) {
                    throw new Error('Request timeout. The URL may be inaccessible.');
                }
                if (error.message.includes('Private video') || error.message.includes('Video unavailable')) {
                    throw new Error('Video is unavailable or private');
                }
            }
            throw new Error(`Failed to analyze URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Normalizes yt-dlp output to match API contract
     * Separates audio/video formats, removes duplicates and unusable formats
     */
    normalizeResponse(info) {
        const rawFormats = info.formats || [];
        const processedFormats = [];
        const seenFormats = new Set(); // Track duplicates
        // Filter and process formats
        for (const format of rawFormats) {
            // Skip formats without required fields
            if (!format.format_id || !format.ext) {
                continue;
            }
            // Skip manifest/playlist formats (m3u8, etc.)
            if (format.ext === 'm3u8' || format.protocol === 'm3u8_native') {
                continue;
            }
            // Determine format type
            const hasVideo = format.vcodec && format.vcodec !== 'none';
            const hasAudio = format.acodec && format.acodec !== 'none';
            // Skip formats with no codec or unusable codecs
            if (!hasVideo && !hasAudio) {
                continue;
            }
            // Skip video-only formats without resolution (likely fragments)
            if (hasVideo && !format.height && !format.width && !format.resolution) {
                continue;
            }
            const type = hasVideo ? 'video' : 'audio';
            // Normalize container type (ext)
            const normalizedExt = this.normalizeContainerType(format.ext);
            // Normalize resolution
            const resolution = this.normalizeResolution(format, type);
            // Normalize file size
            const filesize = this.normalizeFileSize(format.filesize, format.filesize_approx);
            // Create unique key for duplicate detection
            const formatKey = `${type}-${normalizedExt}-${resolution}`;
            if (seenFormats.has(formatKey)) {
                // Keep the format with better file size info if available
                const existingIndex = processedFormats.findIndex(f => f.type === type && f.ext === normalizedExt && f.resolution === resolution);
                if (existingIndex >= 0) {
                    const existing = processedFormats[existingIndex];
                    // Replace if current format has file size and existing doesn't
                    if (filesize !== 'unknown' && existing.filesize === 'unknown') {
                        processedFormats[existingIndex] = {
                            format_id: format.format_id,
                            ext: normalizedExt,
                            resolution,
                            filesize,
                            type,
                        };
                    }
                }
                continue;
            }
            seenFormats.add(formatKey);
            processedFormats.push({
                format_id: format.format_id,
                ext: normalizedExt,
                resolution,
                filesize,
                type,
            });
        }
        // Sort formats: video first, then audio; by resolution/quality
        processedFormats.sort((a, b) => {
            // Separate audio and video
            if (a.type !== b.type) {
                return a.type === 'video' ? -1 : 1;
            }
            // Sort by resolution (extract numeric value)
            const resA = this.extractResolutionValue(a.resolution);
            const resB = this.extractResolutionValue(b.resolution);
            return resB - resA; // Higher resolution first
        });
        // Format duration
        const duration = info.duration
            ? this.formatDuration(info.duration)
            : 'unknown';
        return {
            title: info.title || 'Unknown Title',
            thumbnail: info.thumbnail || '',
            duration,
            formats: processedFormats,
        };
    }
    /**
     * Normalizes container type to standard formats
     */
    normalizeContainerType(ext) {
        const normalized = ext.toLowerCase().trim();
        // Map common variations to standard formats
        const containerMap = {
            'm4a': 'mp4', // Audio MP4
            'm4v': 'mp4', // Video MP4
            'webma': 'webm', // Audio WebM
            'webmv': 'webm', // Video WebM
            'ogg': 'opus', // Opus in Ogg container
        };
        return containerMap[normalized] || normalized;
    }
    /**
     * Normalizes resolution to consistent format
     */
    normalizeResolution(format, type) {
        // Audio formats
        if (type === 'audio') {
            return 'audio';
        }
        // Video formats - prioritize existing resolution string, then calculate
        if (format.resolution && format.resolution !== 'unknown') {
            // Normalize resolution string (e.g., "1920x1080" or "1080p")
            const res = format.resolution.trim();
            if (res.includes('x')) {
                return res; // Keep as-is (e.g., "1920x1080")
            }
            if (res.endsWith('p')) {
                return res; // Keep as-is (e.g., "1080p")
            }
        }
        // Calculate from width/height
        if (format.width && format.height) {
            return `${format.width}x${format.height}`;
        }
        if (format.height) {
            return `${format.height}p`;
        }
        return 'unknown';
    }
    /**
     * Normalizes file size with consistent formatting
     */
    normalizeFileSize(filesize, filesize_approx) {
        if (filesize && filesize > 0) {
            return this.formatFileSize(filesize);
        }
        if (filesize_approx && filesize_approx > 0) {
            return `~${this.formatFileSize(filesize_approx)}`;
        }
        return 'unknown';
    }
    /**
     * Extracts numeric value from resolution string for sorting
     */
    extractResolutionValue(resolution) {
        // Extract number from "1080p" or height from "1920x1080"
        const match = resolution.match(/(\d+)p?/);
        if (match) {
            return parseInt(match[1], 10);
        }
        return 0;
    }
    /**
     * Formats file size in bytes to human-readable format
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        // Round to 2 decimal places, but remove unnecessary zeros
        const rounded = size.toFixed(2);
        const trimmed = parseFloat(rounded).toString();
        return `${trimmed} ${units[unitIndex]}`;
    }
    /**
     * Formats duration in seconds to HH:MM:SS or MM:SS format
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}
exports.YtDlpService = YtDlpService;
//# sourceMappingURL=ytdlpService.js.map