-- Media stores object metadata only. Binary content belongs to the configured
-- StorageProvider, not PostgreSQL.
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'AVAILABLE', 'FAILED', 'REJECTED', 'DELETED');

CREATE TABLE "media" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "uploader_user_id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "storage_key" VARCHAR(512) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "media_byte_size_check" CHECK ("byte_size" > 0),
  CONSTRAINT "media_dimensions_check" CHECK (
    ("width" IS NULL AND "height" IS NULL)
    OR ("width" IS NOT NULL AND "height" IS NOT NULL AND "width" > 0 AND "height" > 0)
  ),
  CONSTRAINT "media_uploader_user_id_fkey"
    FOREIGN KEY ("uploader_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "media_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "flood_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "media_report_id_status_created_at_idx"
  ON "media"("report_id", "status", "created_at");
CREATE INDEX "media_uploader_user_id_created_at_idx"
  ON "media"("uploader_user_id", "created_at");
