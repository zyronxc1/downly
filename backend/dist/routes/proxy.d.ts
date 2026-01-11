import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/proxy/image
 * Proxies image requests to bypass CORS restrictions
 *
 * Query parameters:
 * - url: The image URL to proxy
 */
export declare const imageProxyHandler: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=proxy.d.ts.map