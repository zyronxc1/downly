import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/progress/:downloadId
 * Server-Sent Events endpoint for download progress updates
 */
export declare const progressHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * GET /api/progress/:downloadId/status
 * Get current progress status (non-SSE endpoint for polling)
 */
export declare const progressStatusHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * POST /api/download/:downloadId/cancel
 * Cancel an active download
 */
export declare const cancelDownloadHandler: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=progress.d.ts.map