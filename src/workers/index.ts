import { Worker, Queue } from "bullmq";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { recomputeTrustScore } from "@/services/reputation.service";

const connection = () => {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url } as const;
};

export async function startWorkers() {
  const conn = connection();
  if (!conn) {
    logger.warn("workers_skipped_no_redis");
    return;
  }

  // Ensure redis module is initialized
  getRedis();

  const emailQueue = new Queue("email", { connection: conn });
  const reputationQueue = new Queue("reputation", { connection: conn });

  const emailWorker = new Worker(
    "email",
    async (job) => {
      await sendEmail(job.data as {
        to: string;
        subject: string;
        html: string;
        text?: string;
      });
    },
    { connection: conn },
  );

  const reputationWorker = new Worker(
    "reputation",
    async (job) => {
      const { userId } = job.data as { userId: string };
      await recomputeTrustScore(userId);
    },
    { connection: conn },
  );

  emailWorker.on("failed", (job, err) => {
    logger.error("email_job_failed", { jobId: job?.id, error: err.message });
  });
  reputationWorker.on("failed", (job, err) => {
    logger.error("reputation_job_failed", { jobId: job?.id, error: err.message });
  });

  logger.info("workers_started", {
    queues: [emailQueue.name, reputationQueue.name],
  });
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("workers/index.ts") ||
    process.argv[1].endsWith("workers\\index.ts") ||
    process.argv[1].endsWith("workers/index.js"));

if (isDirectRun) {
  startWorkers().catch((err) => {
    logger.error("workers_boot_failed", { error: String(err) });
    process.exit(1);
  });
}
