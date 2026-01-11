"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAnalyzeHandler = exports.analyzeHandler = void 0;
const ytdlpService_1 = require("../services/ytdlpService");
const urlValidator_1 = require("../utils/urlValidator");
// Extend Error to include statusCode for type compatibility
class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ValidationError';
    }
}
const ytDlpService = new ytdlpService_1.YtDlpService();
/**
 * POST /api/analyze
 * Analyzes a media URL and returns metadata
 */
const analyzeHandler = async (req, res, next) => {
    try {
        const { url } = req.body;
        // Validate request body
        if (!url || typeof url !== 'string') {
            throw new ValidationError('URL is required', 400);
        }
        // Validate URL format
        if (!(0, urlValidator_1.isValidUrl)(url)) {
            throw new ValidationError('Invalid URL format', 400);
        }
        // Analyze URL using yt-dlp
        const result = await ytDlpService.analyzeUrl(url);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.analyzeHandler = analyzeHandler;
/**
 * POST /api/analyze/batch
 * Analyzes multiple media URLs in parallel and returns grouped results
 */
const batchAnalyzeHandler = async (req, res, next) => {
    try {
        const { urls } = req.body;
        // Validate request body
        if (!urls || !Array.isArray(urls)) {
            throw new ValidationError('URLs array is required', 400);
        }
        if (urls.length === 0) {
            throw new ValidationError('At least one URL is required', 400);
        }
        // Limit batch size to prevent abuse
        const MAX_BATCH_SIZE = 20;
        if (urls.length > MAX_BATCH_SIZE) {
            throw new ValidationError(`Maximum ${MAX_BATCH_SIZE} URLs allowed per batch`, 400);
        }
        // Filter out empty URLs and validate each URL independently
        const validUrls = urls
            .map((url) => (typeof url === 'string' ? url.trim() : ''))
            .filter((url) => url.length > 0 && (0, urlValidator_1.isValidUrl)(url));
        if (validUrls.length === 0) {
            throw new ValidationError('No valid URLs found', 400);
        }
        // Analyze all URLs in parallel with individual error handling
        const analyzePromises = validUrls.map(async (url) => {
            try {
                const data = await ytDlpService.analyzeUrl(url);
                return {
                    url,
                    success: true,
                    data,
                };
            }
            catch (error) {
                // Handle errors gracefully for individual URLs
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return {
                    url,
                    success: false,
                    error: errorMessage,
                };
            }
        });
        // Wait for all analyses to complete (parallel execution)
        const results = await Promise.all(analyzePromises);
        // Calculate statistics
        const successful = results.filter((r) => r.success).length;
        const failed = results.length - successful;
        // Include invalid URLs in results (but mark as failed)
        const invalidUrls = urls
            .map((url) => (typeof url === 'string' ? url.trim() : ''))
            .filter((url) => {
            if (url.length === 0)
                return false;
            return !(0, urlValidator_1.isValidUrl)(url);
        })
            .map((url) => ({
            url,
            success: false,
            error: 'Invalid URL format',
        }));
        const allResults = [...results, ...invalidUrls];
        const response = {
            results: allResults,
            total: allResults.length,
            successful,
            failed: failed + invalidUrls.length,
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
exports.batchAnalyzeHandler = batchAnalyzeHandler;
//# sourceMappingURL=analyze.js.map