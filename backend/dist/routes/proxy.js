"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageProxyHandler = void 0;
const urlValidator_1 = require("../utils/urlValidator");
/**
 * GET /api/proxy/image
 * Proxies image requests to bypass CORS restrictions
 *
 * Query parameters:
 * - url: The image URL to proxy
 */
const imageProxyHandler = async (req, res, next) => {
    try {
        const url = req.query.url;
        if (!url) {
            res.status(400).json({
                error: {
                    message: 'Missing required parameter: url',
                },
            });
            return;
        }
        // Validate URL to prevent SSRF attacks
        if (!(0, urlValidator_1.isValidUrl)(url)) {
            res.status(400).json({
                error: {
                    message: 'Invalid URL provided',
                },
            });
            return;
        }
        // Fetch the image
        let fetchResponse;
        try {
            fetchResponse = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                // Timeout after 10 seconds
                signal: AbortSignal.timeout(10000),
            });
        }
        catch (fetchError) {
            if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
                res.status(504).json({
                    error: {
                        message: 'Request timeout while fetching image',
                    },
                });
                return;
            }
            throw fetchError;
        }
        // Check if response is OK
        if (!fetchResponse.ok) {
            res.status(fetchResponse.status).json({
                error: {
                    message: `Failed to fetch image: ${fetchResponse.statusText}`,
                },
            });
            return;
        }
        // Check if it's actually an image
        const contentType = fetchResponse.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            res.status(400).json({
                error: {
                    message: 'URL does not point to an image',
                },
            });
            return;
        }
        // Get image buffer
        const buffer = await fetchResponse.arrayBuffer();
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.setHeader('Content-Length', buffer.byteLength);
        // Send the image
        res.send(Buffer.from(buffer));
    }
    catch (error) {
        console.error('Image proxy error:', error);
        next(error);
    }
};
exports.imageProxyHandler = imageProxyHandler;
//# sourceMappingURL=proxy.js.map