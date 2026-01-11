import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/queue/download
 * Adds a download job to the queue
 * Body: { url: string, format_id: string }
 */
export declare const addDownloadJobHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * POST /api/queue/convert
 * Adds a conversion job to the queue
 * Body: { url?: string, target_format: string, depends_on?: string, input_file?: string }
 *
 * If depends_on is provided, the convert job will wait for that download job to complete.
 * If input_file is provided, it will be used instead of url.
 */
export declare const addConvertJobHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * GET /api/queue
 * Gets the current queue state
 */
export declare const getQueueHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * GET /api/queue/:jobId
 * Gets a specific job by ID
 */
export declare const getJobHandler: (req: Request, res: Response, next: NextFunction) => void;
/**
 * POST /api/queue/:jobId/cancel
 * Cancels a job
 */
export declare const cancelJobHandler: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=queue.d.ts.map