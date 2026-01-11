"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueService = exports.QueueService = void 0;
const events_1 = require("events");
const progressService_1 = require("./progressService");
/**
 * Service for managing download and conversion queue
 * Limits concurrent operations to 1 and processes jobs sequentially
 * Note: Actual streaming happens in route handlers, this service tracks state
 */
class QueueService extends events_1.EventEmitter {
    constructor() {
        super();
        this.jobs = new Map();
        this.queue = []; // Array of job IDs in order
        this.activeJob = null; // 🔥 SINGLE ACTIVE JOB (HARD RULE)
        this.maxConcurrent = 1;
        // Listen to progress updates to update job status
        progressService_1.progressService.on('progress', (progress) => {
            // Find job by downloadId
            for (const job of this.jobs.values()) {
                if (job.downloadId === progress.downloadId) {
                    job.progress = {
                        bytesDownloaded: progress.bytesDownloaded,
                        totalBytes: progress.totalBytes,
                        percentage: progress.percentage,
                    };
                    // Update status based on progress
                    if (progress.status === 'completed') {
                        if (job.status === 'downloading' || job.status === 'converting') {
                            job.status = 'completed';
                            job.completedAt = new Date();
                            // If this is a download job, check for dependent convert jobs
                            if (job.type === 'download') {
                                this.notifyDependentJobs(job.id);
                            }
                            this.emit('jobCompleted', job);
                            // 🔥 CRITICAL: Clear activeJob and continue processing in finally-like pattern
                            this.finishJob(job.id, 'completed');
                        }
                    }
                    else if (progress.status === 'error') {
                        job.status = 'failed';
                        job.error = progress.error;
                        job.completedAt = new Date();
                        // If this is a download job, fail dependent convert jobs
                        if (job.type === 'download') {
                            this.failDependentJobs(job.id, `Dependency failed: ${progress.error}`);
                        }
                        this.emit('jobFailed', job);
                        // 🔥 CRITICAL: Clear activeJob and continue processing in finally-like pattern
                        this.finishJob(job.id, 'failed');
                    }
                    this.emit('jobProgress', job);
                    this.emit('queueUpdated', this.getQueueState());
                    break;
                }
            }
        });
    }
    /**
     * Adds a download job to the queue
     * Returns the job ID and whether it can start immediately
     */
    addDownloadJob(url, formatId, jobId) {
        const id = jobId || this.generateJobId();
        // Don't add duplicate jobs
        if (this.jobs.has(id)) {
            const existingJob = this.jobs.get(id);
            return { jobId: id, canStart: existingJob.status === 'queued' && this.processing === null };
        }
        const job = {
            id,
            type: 'download',
            url,
            formatId,
            status: 'queued',
            createdAt: new Date(),
        };
        this.jobs.set(id, job);
        this.queue.push(id);
        this.emit('jobAdded', job);
        this.emit('queueUpdated', this.getQueueState());
        // Check if we can start immediately
        const canStart = this.activeJob === null && this.queue[0] === id;
        // Try to process queue if we can start
        if (canStart) {
            this.processQueue();
        }
        return { jobId: id, canStart };
    }
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
    addConvertJob(url, targetFormat, dependsOn, inputFile, jobId) {
        const id = jobId || this.generateJobId();
        // Don't add duplicate jobs
        if (this.jobs.has(id)) {
            const existingJob = this.jobs.get(id);
            return { jobId: id, canStart: existingJob.status === 'queued' && this.activeJob === null && this.canJobStart(existingJob) };
        }
        // If depends on another job, verify it exists and is a download job
        if (dependsOn) {
            const dependency = this.jobs.get(dependsOn);
            if (!dependency) {
                throw new Error(`Dependency job ${dependsOn} not found`);
            }
            if (dependency.type !== 'download') {
                throw new Error(`Dependency job ${dependsOn} must be a download job`);
            }
        }
        const job = {
            id,
            type: 'convert',
            url,
            targetFormat,
            dependsOn,
            inputFile,
            status: 'queued',
            createdAt: new Date(),
        };
        this.jobs.set(id, job);
        this.queue.push(id);
        this.emit('jobAdded', job);
        this.emit('queueUpdated', this.getQueueState());
        // Check if we can start immediately (must have no dependency or dependency is completed)
        const canStart = this.activeJob === null && this.queue[0] === id && this.canJobStart(job);
        // Try to process queue if we can start
        if (canStart) {
            this.processQueue();
        }
        return { jobId: id, canStart };
    }
    /**
     * Checks if a job can start (dependency must be completed if it exists)
     */
    canJobStart(job) {
        if (!job.dependsOn) {
            return true; // No dependency, can start
        }
        const dependency = this.jobs.get(job.dependsOn);
        if (!dependency) {
            return false; // Dependency not found
        }
        return dependency.status === 'completed'; // Dependency must be completed
    }
    /**
     * Starts processing a job (called by route handler when ready to stream)
     */
    startJob(jobId, downloadId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        // Check if this job can start (must be first in queue and nothing processing)
        if (this.activeJob !== null) {
            return false;
        }
        if (this.queue[0] !== jobId) {
            return false;
        }
        // Check if dependency is completed (for convert jobs)
        if (!this.canJobStart(job)) {
            return false;
        }
        // Remove from queue and mark as active
        this.queue.shift();
        this.activeJob = jobId;
        job.status = job.type === 'download' ? 'downloading' : 'converting';
        job.startedAt = new Date();
        job.downloadId = downloadId;
        this.emit('jobStarted', job);
        this.emit('queueUpdated', this.getQueueState());
        return true;
    }
    /**
     * Marks a job as completed (called when streaming finishes)
     */
    completeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return;
        }
        job.status = 'completed';
        job.completedAt = new Date();
        // If this is a download job, notify dependent convert jobs
        if (job.type === 'download') {
            this.notifyDependentJobs(job.id);
        }
        this.emit('jobCompleted', job);
        // 🔥 CRITICAL: Clear activeJob and continue processing in finally-like pattern
        this.finishJob(jobId, 'completed');
    }
    /**
     * Marks a job as failed (called when streaming fails)
     */
    failJob(jobId, error) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return;
        }
        job.status = 'failed';
        job.error = error;
        job.completedAt = new Date();
        // If this is a download job, fail dependent convert jobs
        if (job.type === 'download') {
            this.failDependentJobs(job.id, `Dependency failed: ${error}`);
        }
        this.emit('jobFailed', job);
        // 🔥 CRITICAL: Clear activeJob and continue processing in finally-like pattern
        this.finishJob(jobId, 'failed');
    }
    /**
     * 🔥 CRITICAL: Finishes a job and continues queue processing
     * This ensures activeJob is always cleared and queue continues
     */
    finishJob(jobId, status) {
        try {
            // Clear activeJob if this was the active job
            if (this.activeJob === jobId) {
                this.activeJob = null;
            }
            this.emit('queueUpdated', this.getQueueState());
        }
        finally {
            // 🔥 THIS IS CRITICAL: Always continue processing queue
            // If finally is missing → queue freezes
            this.processQueue();
        }
    }
    /**
     * 🔥 SINGLE ACTIVE JOB (HARD RULE)
     * Processes the queue ensuring only one job is active at a time
     */
    processQueue() {
        // If there's an active job or queue is empty, do nothing
        if (this.activeJob !== null || this.queue.length === 0) {
            return;
        }
        // Get next job from queue
        const nextJobId = this.queue[0];
        const nextJob = this.jobs.get(nextJobId);
        if (!nextJob) {
            // Job not found, remove from queue and continue
            this.queue.shift();
            this.processQueue();
            return;
        }
        // Check if job can start (dependencies must be met)
        if (!this.canJobStart(nextJob)) {
            // Job has dependency that's not ready yet
            // Don't process, but emit update
            this.emit('queueUpdated', this.getQueueState());
            return;
        }
        // Job is ready, but actual start happens when route handler calls startJob()
        // This method just ensures the queue continues processing
        this.emit('queueUpdated', this.getQueueState());
    }
    /**
     * Sets the input file for a convert job (called when download job completes)
     */
    setConvertJobInputFile(convertJobId, inputFile) {
        const job = this.jobs.get(convertJobId);
        if (!job || job.type !== 'convert') {
            return false;
        }
        job.inputFile = inputFile;
        this.emit('queueUpdated', this.getQueueState());
        return true;
    }
    /**
     * Notifies dependent convert jobs that their dependency (download job) has completed
     */
    notifyDependentJobs(downloadJobId) {
        for (const job of this.jobs.values()) {
            if (job.type === 'convert' && job.dependsOn === downloadJobId && job.status === 'queued') {
                // Dependency completed, convert job can now start
                this.emit('dependencyCompleted', job);
                this.emit('queueUpdated', this.getQueueState());
            }
        }
    }
    /**
     * Fails dependent convert jobs when their dependency (download job) fails
     */
    failDependentJobs(downloadJobId, error) {
        for (const job of this.jobs.values()) {
            if (job.type === 'convert' && job.dependsOn === downloadJobId && job.status === 'queued') {
                // Remove from queue
                const queueIndex = this.queue.indexOf(job.id);
                if (queueIndex !== -1) {
                    this.queue.splice(queueIndex, 1);
                }
                // Mark as failed
                job.status = 'failed';
                job.error = error;
                job.completedAt = new Date();
                this.emit('jobFailed', job);
            }
        }
    }
    /**
     * Cancels a job
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        // Remove from queue if not yet processing
        const queueIndex = this.queue.indexOf(jobId);
        if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
        }
        // If currently processing, cancel the process
        if (this.activeJob === jobId) {
            if (job.downloadId) {
                progressService_1.progressService.cancelDownload(job.downloadId);
            }
            this.activeJob = null;
        }
        // Update job status
        job.status = 'failed';
        job.error = 'Cancelled by user';
        job.completedAt = new Date();
        this.emit('jobCancelled', job);
        this.emit('queueUpdated', this.getQueueState());
        // 🔥 CRITICAL: Continue processing queue after cancellation
        this.processQueue();
        return true;
    }
    /**
     * Gets a job by ID
     */
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    /**
     * Gets all jobs
     */
    getAllJobs() {
        return Array.from(this.jobs.values());
    }
    /**
     * Gets queue state
     */
    getQueueState() {
        const jobs = this.getAllJobs();
        return {
            jobs,
            queue: [...this.queue],
            processing: this.activeJob,
            queuedCount: jobs.filter(j => j.status === 'queued').length,
            processingCount: jobs.filter(j => j.status === 'downloading' || j.status === 'converting').length,
            completedCount: jobs.filter(j => j.status === 'completed').length,
            failedCount: jobs.filter(j => j.status === 'failed').length,
        };
    }
    /**
     * Cleans up old completed/failed jobs
     */
    cleanupOldJobs(maxAge = 30 * 60 * 1000) {
        const now = Date.now();
        for (const [jobId, job] of this.jobs.entries()) {
            if ((job.status === 'completed' || job.status === 'failed') &&
                job.completedAt &&
                now - job.completedAt.getTime() > maxAge) {
                this.jobs.delete(jobId);
            }
        }
    }
    /**
     * Generates a unique job ID
     */
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}
exports.QueueService = QueueService;
// Export singleton instance
exports.queueService = new QueueService();
// Clean up old jobs every 5 minutes
setInterval(() => {
    exports.queueService.cleanupOldJobs();
}, 5 * 60 * 1000);
//# sourceMappingURL=queueService.js.map