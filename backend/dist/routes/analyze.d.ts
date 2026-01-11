import { Request, Response, NextFunction } from 'express';
import { AnalyzeRequest, AnalyzeResponse, BatchAnalyzeRequest, BatchAnalyzeResponse } from '../types/api';
/**
 * POST /api/analyze
 * Analyzes a media URL and returns metadata
 */
export declare const analyzeHandler: (req: Request<{}, AnalyzeResponse, AnalyzeRequest>, res: Response<AnalyzeResponse>, next: NextFunction) => Promise<void>;
/**
 * POST /api/analyze/batch
 * Analyzes multiple media URLs in parallel and returns grouped results
 */
export declare const batchAnalyzeHandler: (req: Request<{}, BatchAnalyzeResponse, BatchAnalyzeRequest>, res: Response<BatchAnalyzeResponse>, next: NextFunction) => Promise<void>;
//# sourceMappingURL=analyze.d.ts.map