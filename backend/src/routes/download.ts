import { Request, Response, NextFunction } from 'express';
import { DownloadService } from '../services/downloadService';
import { progressService } from '../services/progressService';
import { queueService } from '../services/queueService';
import { ApiError } from '../middleware/errorHandler';
import { safeFilename } from '../utils/safeFilename';

class ValidationError extends Error implements ApiError {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ValidationError';
  }
}

const downloadService = new DownloadService();

/**
 * GET /api/download
 * Streams media file to browser
 * Query params: 
 *   - jobId: Job ID from queue (preferred)
 *   - url, format_id: Direct download (legacy, will be queued)
 *   - download_id (optional - if not provided, will be generated)
 */
export const downloadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { jobId, url, format_id, download_id } = req.query;
    let job = null;
    let actualUrl: string;
    let actualFormatId: string;
    let actualDownloadId: string;

    // If jobId is provided, use queue system
    if (jobId && typeof jobId === 'string') {
      job = queueService.getJob(jobId);
      if (!job) {
        throw new ValidationError('Job not found', 404);
      }

      if (job.type !== 'download') {
        throw new ValidationError('Job is not a download job', 400);
      }

      // Check if job can start
      if (!queueService.startJob(jobId, jobId)) {
        // Job cannot start yet (another job is processing)
        res.status(409).json({
          error: {
            message: 'Job is queued and cannot start yet. Another job is currently processing.',
          },
        });
        return;
      }

      actualUrl = job.url;
      actualFormatId = job.formatId!;
      actualDownloadId = jobId; // Use jobId as downloadId for progress tracking
    } else {
      // Legacy mode: direct download (will be queued automatically)
      if (!url || typeof url !== 'string') {
        throw new ValidationError('URL query parameter is required (or provide jobId)', 400);
      }

      if (!format_id || typeof format_id !== 'string') {
        throw new ValidationError('format_id query parameter is required (or provide jobId)', 400);
      }

      // Add to queue
      const { jobId: newJobId, canStart } = queueService.addDownloadJob(url, format_id);
      job = queueService.getJob(newJobId)!;

      if (!canStart) {
        // Job is queued, return jobId for client to poll
        res.status(202).json({
          jobId: newJobId,
          message: 'Job added to queue. Use jobId to check status and download when ready.',
          canStart: false,
        });
        return;
      }

      // Can start immediately
      if (!queueService.startJob(newJobId, newJobId)) {
        res.status(409).json({
          error: {
            message: 'Job could not start. Please try again.',
          },
        });
        return;
      }

      actualUrl = url;
      actualFormatId = format_id;
      actualDownloadId = download_id as string || newJobId;
    }

    // Generate or use provided download ID and create session
    const progressDownloadId = progressService.createSession(
      actualUrl,
      actualFormatId,
      actualDownloadId
    );
    
    // Update job with progress downloadId
    if (job) {
      job.downloadId = progressDownloadId;
    }

    // Get download info (filename, content type)
    let downloadInfo;
    try {
      downloadInfo = await downloadService.getDownloadInfo(actualUrl, actualFormatId);
    } catch (error) {
      // If metadata extraction fails, use defaults
      downloadInfo = {
        filename: 'download.mp4',
        contentType: 'video/mp4',
        extension: 'mp4',
      };
    }

    // Sanitize filename for HTTP headers (remove emojis, special chars)
    // safeFilename preserves dots, so the extension will be kept
    const filename = safeFilename(downloadInfo.filename);

    // Set response headers
    res.setHeader('Content-Type', downloadInfo.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    
    // Disable caching for downloads
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Include download ID in response headers for client reference
    res.setHeader('X-Download-Id', progressDownloadId);
    if (job) {
      res.setHeader('X-Job-Id', job.id);
    }

    // Stream the download with progress tracking
    const { stream, cleanup } = downloadService.streamDownload(actualUrl, actualFormatId, progressDownloadId);

    // 🔥 CRITICAL: Wait for stream to complete with proper end/error handlers
    // If you don't do this, the job never completes
    // Set up handlers BEFORE piping to avoid race conditions
    const streamPromise = new Promise<void>((resolve, reject) => {
      stream.on('end', () => {
        // Stream completed successfully
        if (job) {
          queueService.completeJob(job.id);
        }
        progressService.markCompleted(progressDownloadId);
        resolve();
      });

      stream.on('error', (error: Error) => {
        // Stream error occurred
        cleanup();
        progressService.markError(progressDownloadId, error.message || 'Download failed');
        if (job) {
          queueService.failJob(job.id, error.message || 'Download failed');
        }
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: error.message || 'Download failed',
            },
          });
        } else {
          // If headers are already sent, we can't send JSON, so end the response
          res.end();
        }
        reject(error);
      });
    });

    // Pipe stream to response (after handlers are set up)
    stream.pipe(res);

    // Wait for stream to complete
    try {
      await streamPromise;
    } catch (streamError) {
      // Error already handled in stream.on('error'), just prevent unhandled rejection
      // Don't call next() here as response may have already been sent
      if (!res.headersSent) {
        next(streamError);
      }
    }

    // Handle client disconnect
    req.on('close', () => {
      cleanup();
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        queueService.failJob(job.id, 'Client disconnected');
      }
      if (!stream.destroyed) {
        stream.destroy();
      }
    });

    // Cleanup when response finishes
    res.on('close', () => {
      cleanup();
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        // Only mark as failed if it wasn't already completed
        const currentJob = queueService.getJob(job.id);
        if (currentJob && currentJob.status === 'downloading') {
          queueService.failJob(job.id, 'Response closed unexpectedly');
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

