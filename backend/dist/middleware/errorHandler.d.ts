import { Request, Response, NextFunction } from 'express';
export interface ApiError extends Error {
    statusCode?: number;
    status?: number;
}
export declare class AppError extends Error implements ApiError {
    statusCode: number;
    constructor(message: string, statusCode?: number);
}
/**
 * Error handling middleware for Express
 * Handles errors and sends appropriate responses
 */
export declare const errorHandler: (err: ApiError, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map