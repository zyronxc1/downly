import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/download
 * Streams media file to browser
 * Query params:
 *   - jobId: Job ID from queue (preferred)
 *   - url, format_id: Direct download (legacy, will be queued)
 *   - download_id (optional - if not provided, will be generated)
 */
export declare const downloadHandler: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=download.d.ts.map