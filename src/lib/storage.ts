import { randomUUID } from "crypto";
import { AppError } from "@/domain/errors";
import { getEnv } from "@/lib/env";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

const MAX_BYTES = 25 * 1024 * 1024;

export function assertSafeUpload(mimeType: string, sizeBytes: number): void {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new AppError(`File type not allowed: ${mimeType}`, {
      code: "BAD_REQUEST",
      status: 400,
    });
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    throw new AppError("File must be between 1 byte and 25MB", {
      code: "BAD_REQUEST",
      status: 400,
    });
  }
}

export function buildStorageKey(userId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const day = new Date().toISOString().slice(0, 10);
  return `uploads/${userId}/${day}/${randomUUID()}-${safe}`;
}

export async function createPresignedUploadUrl(params: {
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
  assertSafeUpload(params.mimeType, params.sizeBytes);
  const env = getEnv();
  const storageKey = buildStorageKey(params.userId, params.filename);

  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
    return {
      uploadUrl: `/api/v1/uploads/local?key=${encodeURIComponent(storageKey)}`,
      storageKey,
      expiresIn: 900,
    };
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: Boolean(env.S3_ENDPOINT),
  });

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    ContentType: params.mimeType,
    ContentLength: params.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });
  return { uploadUrl, storageKey, expiresIn: 900 };
}
