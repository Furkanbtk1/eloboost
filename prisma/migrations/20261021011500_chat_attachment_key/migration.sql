-- Chat attachments now live in a private S3-compatible bucket; the column holds the object key.
ALTER TABLE "Message" RENAME COLUMN "attachmentUrl" TO "attachmentKey";

-- Earlier values were placeholder paths, not keys in the bucket.
UPDATE "Message" SET "attachmentKey" = NULL WHERE "attachmentKey" NOT LIKE 'orders/%';
