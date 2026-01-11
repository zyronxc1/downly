import { EventEmitter } from 'events';
import { ConversionFormat } from './conversionService';
import { progressService } from './progressService';

export type JobType = 'download' | 'convert';
export type JobStatus = 'queued' | 'downloading' | 'converting' | 'completed' | 'failed';

export interface QueueJob {
  id: string;
  type: JobType;
  url: string;
  formatId?: string; // For download jobs
  targetFormat?: ConversionFormat; // For convert jobs
  inputFile?: string; // For convert jobs - path to downloaded file (if depends on download job)
  dependsOn?: string; // Job ID this job depends on (convert jobs depend on download jobs)
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  downloadId?: string; // Progress tracking ID
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
export class QueueService extends EventEmitter {
  private jobs: Map<string, QueueJob> = new Map();
  private queue: string[] = []; // Array of job IDs in order
  private activeJob: string | null = null; // 🔥 SINGLE ACTIVE JOB (HARD RULE)
  private readonly maxConcurrent: number = 1;

  constructor() {
    super();
    
    // Listen to progress updates to update job status
    progressService.on('progress', (progress) => {
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
          } else if (progress.status === 'error') {
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
  addDownloadJob(url: string, formatId: string, jobId?: string): { jobId: string; canStart: boolean } {
    const id = jobId || this.generateJobId();
    
    // Don't add duplicate jobs
    if (this.jobs.has(id)) {
      const existingJob = this.jobs.get(id)!;
      return { jobId: id, canStart: existingJob.status === 'queued' && this.processing === null };
    }

    const job: QueueJob = {
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
  addConvertJob(
    url: string,
    targetFormat: ConversionFormat,
    dependsOn?: string,
    inputFile?: string,
    jobId?: string
  ): { jobId: string; canStart: boolean } {
    const id = jobId || this.generateJobId();
    
    // Don't add duplicate jobs
    if (this.jobs.has(id)) {
      const existingJob = this.jobs.get(id)!;
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

    const job: QueueJob = {
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
  private canJobStart(job: QueueJob): boolean {
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
  startJob(jobId: string, downloadId: string): boolean {
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
  completeJob(jobId: string): void {
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
  failJob(jobId: string, error: string): void {
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
  private finishJob(jobId: string, status: 'completed' | 'failed'): void {
    try {
      // Clear activeJob if this was the active job
      if (this.activeJob === jobId) {
        this.activeJob = null;
      }
      
      this.emit('queueUpdated', this.getQueueState());
    } finally {
      // 🔥 THIS IS CRITICAL: Always continue processing queue
      // If finally is missing → queue freezes
      this.processQueue();
    }
  }

  /**
   * 🔥 SINGLE ACTIVE JOB (HARD RULE)
   * Processes the queue ensuring only one job is active at a time
   */
  private processQueue(): void {
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
  setConvertJobInputFile(convertJobId: string, inputFile: string): boolean {
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
  private notifyDependentJobs(downloadJobId: string): void {
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
  private failDependentJobs(downloadJobId: string, error: string): void {
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
  cancelJob(jobId: string): boolean {
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
        progressService.cancelDownload(job.downloadId);
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
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Gets all jobs
   */
  getAllJobs(): QueueJob[] {
    return Array.from(this.jobs.values());
  }

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
  } {
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
  cleanupOldJobs(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAge
      ) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Generates a unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Export singleton instance
export const queueService = new QueueService();

// Clean up old jobs every 5 minutes
setInterval(() => {
  queueService.cleanupOldJobs();
}, 5 * 60 * 1000);

