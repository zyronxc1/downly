/**
 * URL validation utilities
 * Validates media URLs before processing
 * Implements strict validation to prevent abuse
 */
/**
 * Strictly validates if a URL is a valid HTTP/HTTPS URL
 * Prevents localhost, private IPs, and dangerous protocols
 */
export declare function isValidUrl(url: string): boolean;
/**
 * Validates if a URL might be a supported media URL
 * This is a basic check - yt-dlp will handle the actual validation
 */
export declare function isSupportedMediaUrl(url: string): boolean;
//# sourceMappingURL=urlValidator.d.ts.map