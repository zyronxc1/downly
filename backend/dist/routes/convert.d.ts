import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/convert
 * Converts media and streams converted output
 * Body: { url: string, target_format: string, jobId?: string }
 * If jobId is provided, uses queue system. Otherwise, adds to queue automatically.
 */
export declare const convertHandler: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=convert.d.ts.map