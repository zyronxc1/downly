"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeFilename = safeFilename;
/**
 * Sanitizes a filename to be safe for HTTP headers
 * Removes emojis, special characters, and ensures the filename is header-safe
 *
 * @param name - The original filename/title
 * @returns Sanitized filename safe for HTTP headers
 */
function safeFilename(name) {
    if (!name || typeof name !== 'string') {
        return 'download';
    }
    return name
        .replace(/[^\w\s.-]/g, '') // Remove emojis & special chars (keep alphanumeric, spaces, dots, hyphens)
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .slice(0, 100) // Prevent long filenames
        .trim() || 'download'; // Fallback to 'download' if empty
}
//# sourceMappingURL=safeFilename.js.map