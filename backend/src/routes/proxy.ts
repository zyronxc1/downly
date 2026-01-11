import { Request, Response, NextFunction } from 'express';
import { isValidUrl } from '../utils/urlValidator';

/**
 * GET /api/proxy/image
 * Proxies image requests to bypass CORS restrictions
 * 
 * Query parameters:
 * - url: The image URL to proxy
 */
export const imageProxyHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const url = req.query.url as string;

    if (!url) {
      res.status(400).json({
        error: {
          message: 'Missing required parameter: url',
        },
      });
      return;
    }

    // Validate URL to prevent SSRF attacks
    if (!isValidUrl(url)) {
      res.status(400).json({
        error: {
          message: 'Invalid URL provided',
        },
      });
      return;
    }

    // Fetch the image
    let fetchResponse: globalThis.Response;
    try {
      fetchResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      });
    } catch (fetchError: any) {
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
  } catch (error: any) {
    console.error('Image proxy error:', error);
    next(error);
  }
};

