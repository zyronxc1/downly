"use strict";
/**
 * URL validation utilities
 * Validates media URLs before processing
 * Implements strict validation to prevent abuse
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUrl = isValidUrl;
exports.isSupportedMediaUrl = isSupportedMediaUrl;
/**
 * Blocked URL patterns for security
 */
const BLOCKED_PATTERNS = [
    /^localhost/i,
    /^127\./,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^0\.0\.0\.0/,
    /^file:/i,
    /^ftp:/i,
    /^data:/i,
    /^javascript:/i,
    /^vbscript:/i,
];
/**
 * Strictly validates if a URL is a valid HTTP/HTTPS URL
 * Prevents localhost, private IPs, and dangerous protocols
 */
function isValidUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    // Check length to prevent extremely long URLs
    if (url.length > 2048) {
        return false;
    }
    try {
        const urlObj = new URL(url);
        // Only allow HTTP and HTTPS protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return false;
        }
        // Block localhost and private IPs
        const hostname = urlObj.hostname.toLowerCase();
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(hostname)) {
                return false;
            }
        }
        // Block localhost explicitly
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return false;
        }
        // Validate hostname format
        if (!hostname || hostname.length === 0) {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validates if a URL might be a supported media URL
 * This is a basic check - yt-dlp will handle the actual validation
 */
function isSupportedMediaUrl(url) {
    if (!isValidUrl(url)) {
        return false;
    }
    // Common media platform patterns
    const supportedPatterns = [
        /youtube\.com/,
        /youtu\.be/,
        /vimeo\.com/,
        /dailymotion\.com/,
        /facebook\.com/,
        /instagram\.com/,
        /twitter\.com/,
        /tiktok\.com/,
        /soundcloud\.com/,
        /spotify\.com/,
        /reddit\.com/,
        /twitch\.tv/,
    ];
    // If URL matches known patterns or has common video extensions
    const hasKnownPattern = supportedPatterns.some(pattern => pattern.test(url));
    const hasVideoExtension = /\.(mp4|webm|m3u8|mp3|m4a)(\?|$)/i.test(url);
    return hasKnownPattern || hasVideoExtension;
}
//# sourceMappingURL=urlValidator.js.map