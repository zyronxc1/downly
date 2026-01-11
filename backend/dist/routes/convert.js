"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertHandler = void 0;
const conversionService_1 = require("../services/conversionService");
const queueService_1 = require("../services/queueService");
class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ValidationError';
    }
}
const conversionService = new conversionService_1.ConversionService();
/**
 * POST /api/convert
 * Converts media and streams converted output
 * Body: { url: string, target_format: string, jobId?: string }
 * If jobId is provided, uses queue system. Otherwise, adds to queue automatically.
 */
const convertHandler = async (req, res, next) => {
    try {
        const { url, target_format, jobId } = req.body;
        let job = null;
        let actualUrl;
        let actualFormat;
        // If jobId is provided, use queue system
        if (jobId && typeof jobId === 'string') {
            job = queueService_1.queueService.getJob(jobId);
            if (!job) {
                throw new ValidationError('Job not found', 404);
            }
            if (job.type !== 'convert') {
                throw new ValidationError('Job is not a conversion job', 400);
            }
            // Check if job can start
            if (!queueService_1.queueService.startJob(jobId, jobId)) {
                // Job cannot start yet (another job is processing)
                res.status(409).json({
                    error: {
                        message: 'Job is queued and cannot start yet. Another job is currently processing.',
                    },
                });
                return;
            }
            actualUrl = job.url;
            actualFormat = job.targetFormat;
        }
        else {
            // Legacy mode: direct conversion (will be queued automatically)
            if (!url || typeof url !== 'string') {
                throw new ValidationError('URL is required (or provide jobId)', 400);
            }
            if (!target_format || typeof target_format !== 'string') {
                throw new ValidationError('target_format is required (or provide jobId)', 400);
            }
            // Validate format
            if (!conversionService.isValidFormat(target_format)) {
                throw new ValidationError(`Unsupported format: ${target_format}. Supported formats: mp3, mp4, webm, aac`, 400);
            }
            const format = target_format.toLowerCase();
            // Add to queue
            const { jobId: newJobId, canStart } = queueService_1.queueService.addConvertJob(url, format);
            job = queueService_1.queueService.getJob(newJobId);
            if (!canStart) {
                // Job is queued, return jobId for client to poll
                res.status(202).json({
                    jobId: newJobId,
                    message: 'Job added to queue. Use jobId to check status and convert when ready.',
                    canStart: false,
                });
                return;
            }
            // Can start immediately
            if (!queueService_1.queueService.startJob(newJobId, newJobId)) {
                res.status(409).json({
                    error: {
                        message: 'Job could not start. Please try again.',
                    },
                });
                return;
            }
            actualUrl = url;
            actualFormat = format;
        }
        // Get converted filename and content type
        let filename;
        let contentType;
        try {
            filename = await conversionService.getConvertedFilename(actualUrl, actualFormat);
            contentType = conversionService.getContentType(actualFormat);
        }
        catch (error) {
            // Fallback if metadata extraction fails
            const extension = conversionService.getFileExtension(actualFormat);
            filename = `converted.${extension}`;
            contentType = conversionService.getContentType(actualFormat);
        }
        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        // Disable caching for conversions
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        if (job) {
            res.setHeader('X-Job-Id', job.id);
        }
        // Convert and stream media
        const { stream, cleanup } = conversionService.convertMedia(actualUrl, actualFormat);
        // 🔥 CRITICAL: Wait for stream to complete with proper end/error handlers
        // If you don't do this, the job never completes
        // Set up handlers BEFORE piping to avoid race conditions
        const streamPromise = new Promise((resolve, reject) => {
            stream.on('end', () => {
                // Stream completed successfully
                if (job) {
                    queueService_1.queueService.completeJob(job.id);
                }
                resolve();
            });
            stream.on('error', (error) => {
                // Stream error occurred
                cleanup();
                if (job) {
                    queueService_1.queueService.failJob(job.id, error.message || 'Conversion failed');
                }
                if (!res.headersSent) {
                    res.status(500).json({
                        error: {
                            message: error.message || 'Conversion failed',
                        },
                    });
                }
                else {
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
        }
        catch (streamError) {
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
                queueService_1.queueService.failJob(job.id, 'Client disconnected');
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
                const currentJob = queueService_1.queueService.getJob(job.id);
                if (currentJob && currentJob.status === 'converting') {
                    queueService_1.queueService.failJob(job.id, 'Response closed unexpectedly');
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.convertHandler = convertHandler;
//# sourceMappingURL=convert.js.map