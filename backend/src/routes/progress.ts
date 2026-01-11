import { Request, Response, NextFunction } from 'express';
import { progressService } from '../services/progressService';

class ValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ValidationError';
  }
}

/**
 * GET /api/progress/:downloadId
 * Server-Sent Events endpoint for download progress updates
 */
export const progressHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { downloadId } = req.params;

    if (!downloadId) {
      throw new ValidationError('downloadId parameter is required', 400);
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx
    
    // CRITICAL: Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', downloadId })}\n\n`);

    // Send current progress if available
    const currentProgress = progressService.getProgress(downloadId);
    if (currentProgress) {
      res.write(`data: ${JSON.stringify({ type: 'progress', ...currentProgress })}\n\n`);
    }

    // Listen for progress updates
    const progressListener = (progress: any) => {
      if (progress.downloadId === downloadId) {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
      }
    };

    progressService.on('progress', progressListener);

    // Handle client disconnect
    req.on('close', () => {
      progressService.removeListener('progress', progressListener);
      res.end();
    });

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
      } else {
        clearInterval(heartbeatInterval);
        progressService.removeListener('progress', progressListener);
      }
    }, 30000);

    // Clean up on response end
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      progressService.removeListener('progress', progressListener);
      res.end();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/progress/:downloadId/status
 * Get current progress status (non-SSE endpoint for polling)
 */
export const progressStatusHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { downloadId } = req.params;

    if (!downloadId) {
      throw new ValidationError('downloadId parameter is required', 400);
    }

    const progress = progressService.getProgress(downloadId);

    if (!progress) {
      res.status(404).json({
        error: {
          message: 'Download session not found',
        },
      });
      return;
    }

    res.json(progress);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/download/:downloadId/cancel
 * Cancel an active download
 */
export const cancelDownloadHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { downloadId } = req.params;

    if (!downloadId) {
      throw new ValidationError('downloadId parameter is required', 400);
    }

    const cancelled = progressService.cancelDownload(downloadId);

    if (!cancelled) {
      res.status(404).json({
        error: {
          message: 'Download session not found or already completed',
        },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Download cancelled successfully',
      downloadId,
    });
  } catch (error) {
    next(error);
  }
};

