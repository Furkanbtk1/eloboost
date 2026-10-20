import "server-only";

import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "@/lib/env";

/**
 * Private S3-compatible bucket (RustFS locally, Cloudflare R2 / AWS S3 in
 * production). Objects are never public: the app streams them to authorized
 * users through a route handler.
 */

const bucket = env.S3_BUCKET;

const client =
  bucket && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
        // Default CRC checksums are not supported by every S3-compatible store.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      })
    : null;

export const storageEnabled = client !== null;

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  if (!client) throw new Error("Storage is not configured (S3_*).");
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

/** The object's bytes as a stream, or null when it does not exist. */
export async function getObjectStream(key: string): Promise<ReadableStream | null> {
  if (!client) return null;
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return object.Body?.transformToWebStream() ?? null;
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}
