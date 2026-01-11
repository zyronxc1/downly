import { Request, Response, NextFunction } from 'express';
import { queueService } from '../services/queueService';
import { ApiError } from '../middleware/errorHandler';

class ValidationError extends Error implements ApiError {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ValidationError';
  }
}

/**
 * POST /api/queue/download
 * Adds a download job to the queue
 * Body: { url: string, format_id: string }
 */
export const addDownloadJobHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { url, format_id } = req.body;

    if (!url || typeof url !== 'string') {
      throw new ValidationError('URL is required', 400);
    }

    if (!format_id || typeof format_id !== 'string') {
      throw new ValidationError('format_id is required', 400);
    }

    const { jobId, canStart } = queueService.addDownloadJob(url, format_id);

    res.json({
      jobId,
      canStart,
      message: canStart ? 'Job added and can start immediately' : 'Job added to queue',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/queue/convert
 * Adds a conversion job to the queue
 * Body: { url?: string, target_format: string, depends_on?: string, input_file?: string }
 * 
 * If depends_on is provided, the convert job will wait for that download job to complete.
 * If input_file is provided, it will be used instead of url.
 */
export const addConvertJobHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { url, target_format, depends_on, input_file } = req.body;

    // URL is optional if depends_on or input_file is provided
    if (!url && !depends_on && !input_file) {
      throw new ValidationError('Either url, depends_on, or input_file is required', 400);
    }

    if (!target_format || typeof target_format !== 'string') {
      throw new ValidationError('target_format is required', 400);
    }

    // Validate format
    const { ConversionService } = require('../services/conversionService');
    const conversionService = new ConversionService();
    if (!conversionService.isValidFormat(target_format)) {
      throw new ValidationError(
        `Unsupported format: ${target_format}. Supported formats: mp3, mp4, webm, aac`,
        400
      );
    }

    // Use url from dependency if depends_on is provided and url is not provided
    let actualUrl = url || '';
    if (depends_on && !url) {
      const dependencyJob = queueService.getJob(depends_on);
      if (dependencyJob && dependencyJob.type === 'download') {
        actualUrl = dependencyJob.url;
      }
    }

    const { jobId, canStart } = queueService.addConvertJob(
      actualUrl,
      target_format.toLowerCase() as any,
      depends_on,
      input_file
    );

    res.json({
      jobId,
      canStart,
      message: canStart ? 'Job added and can start immediately' : 'Job added to queue',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/queue
 * Gets the current queue state
 */
export const getQueueHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const queueState = queueService.getQueueState();
    res.json(queueState);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/queue/:jobId
 * Gets a specific job by ID
 */
export const getJobHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      throw new ValidationError('jobId parameter is required', 400);
    }

    const job = queueService.getJob(jobId);

    if (!job) {
      res.status(404).json({
        error: {
          message: 'Job not found',
        },
      });
      return;
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/queue/:jobId/cancel
 * Cancels a job
 */
export const cancelJobHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      throw new ValidationError('jobId parameter is required', 400);
    }

    const cancelled = queueService.cancelJob(jobId);

    if (!cancelled) {
      res.status(404).json({
        error: {
          message: 'Job not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully',
      jobId,
    });
  } catch (error) {
    next(error);
  }
};

