import { nanoid } from "../lib/nanoid";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface ScrapeJob {
  id: string;
  tenderId: string;
  status: JobStatus;
  progressMessage: string;
  progressPercent: number;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

class JobManager {
  private jobs: Map<string, ScrapeJob> = new Map();

  public createJob(tenderId: string): string {
    const id = nanoid();
    const now = Date.now();
    this.jobs.set(id, {
      id,
      tenderId,
      status: "pending",
      progressMessage: "Posao kreiran...",
      progressPercent: 0,
      createdAt: now,
      updatedAt: now,
    });
    
    // Clean up old jobs (older than 1 hour)
    this.cleanup();
    
    return id;
  }

  public getJob(id: string): ScrapeJob | undefined {
    return this.jobs.get(id);
  }

  public updateJob(id: string, update: Partial<Omit<ScrapeJob, "id" | "tenderId" | "createdAt" | "updatedAt">>) {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, {
        ...job,
        ...update,
        updatedAt: Date.now(),
      });
    }
  }

  public failJob(id: string, error: string) {
    this.updateJob(id, { status: "failed", error, progressMessage: "Greška: " + error });
  }

  public completeJob(id: string, result?: any) {
    this.updateJob(id, { status: "completed", progressPercent: 100, progressMessage: "Završeno", result });
  }

  private cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, job] of this.jobs.entries()) {
      if (job.updatedAt < oneHourAgo && (job.status === "completed" || job.status === "failed")) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobManager = new JobManager();
