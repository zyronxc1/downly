import { EventEmitter } from 'events';
import { ConversionFormat } from './conversionService';
export type JobType = 'download' | 'convert';
export type JobStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'failed';
export interface QueueJob {
    id: string;
    type: JobType;
    url: string;
    formatId?: string;
    targetFormat?: ConversionFormat;
    inputFile?: string;
    dependsOn?: string;
    status: JobStatus;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    downloadId?: string;
    progress?: {
        bytesDownloaded: number;
        totalBytes: number | null;
        percentage: number | null;
    };
}
/**
 * Service for managing download and conversion queue
 * Limits concurrent operations to 1 and processes jobs sequentially
 * Note: Actual streaming happens in route handlers, this service tracks state
 */
export declare class QueueService extends EventEmitter {
    private jobs;
    private queue;
    private activeJob;
    private readonly maxConcurrent;
    constructor();
    /**
     * Adds a download job to the queue
     * Returns the job ID and whether it can start immediately
     */
    addDownloadJob(url: string, formatId: string, jobId?: string): {
        jobId: string;
        canStart: boolean;
    };
    /**
     * Adds a conversion job to the queue
     * Returns the job ID and whether it can start immediately
     *
     * @param url - Media URL (if converting from URL directly)
     * @param targetFormat - Target conversion format
     * @param dependsOn - Optional: Job ID of download job this convert job depends on
     * @param inputFile - Optional: Path to downloaded file (if depends on download job)
     * @param jobId - Optional: Custom job ID
     */
    addConvertJob(url: string, targetFormat: ConversionFormat, dependsOn?: string, inputFile?: string, jobId?: string): {
        jobId: string;
        canStart: boolean;
    };
    /**
     * Checks if a job can start (dependency must be completed if it exists)
     */
    private canJobStart;
    /**
     * Starts processing a job (called by route handler when ready to stream)
     */
    startJob(jobId: string, downloadId: string): boolean;
    /**
     * Marks a job as completed (called when streaming finishes)
     */
    completeJob(jobId: string): void;
    /**
     * Marks a job as failed (called when streaming fails)
     */
    failJob(jobId: string, error: string): void;
    /**
     * 🔥 CRITICAL: Finishes a job and continues queue processing
     * This ensures activeJob is always cleared and queue continues
     */
    private finishJob;
    /**
     * 🔥 SINGLE ACTIVE JOB (HARD RULE)
     * Processes the queue ensuring only one job is active at a time
     */
    private processQueue;
    /**
     * Sets the input file for a convert job (called when download job completes)
     */
    setConvertJobInputFile(convertJobId: string, inputFile: string): boolean;
    /**
     * Notifies dependent convert jobs that their dependency (download job) has completed
     */
    private notifyDependentJobs;
    /**
     * Fails dependent convert jobs when their dependency (download job) fails
     */
    private failDependentJobs;
    /**
     * Cancels a job
     */
    cancelJob(jobId: string): boolean;
    /**
     * Gets a job by ID
     */
    getJob(jobId: string): QueueJob | undefined;
    /**
     * Gets all jobs
     */
    getAllJobs(): QueueJob[];
    /**
     * Gets queue state
     */
    getQueueState(): {
        jobs: QueueJob[];
        queue: string[];
        processing: string | null;
        queuedCount: number;
        processingCount: number;
        completedCount: number;
        failedCount: number;
    };
    /**
     * Cleans up old completed/failed jobs
     */
    cleanupOldJobs(maxAge?: number): void;
    /**
     * Generates a unique job ID
     */
    private generateJobId;
}
export declare const queueService: QueueService;
//# sourceMappingURL=queueService.d.ts.map