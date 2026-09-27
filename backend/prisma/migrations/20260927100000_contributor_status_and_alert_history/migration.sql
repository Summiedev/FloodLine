CREATE TYPE "ContributorStatus" AS ENUM ('STANDARD', 'VERIFIED', 'SUSPENDED');

CREATE TABLE "user_contributor_statuses" (
  "user_id" UUID NOT NULL,
  "status" "ContributorStatus" NOT NULL DEFAULT 'STANDARD',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_by" UUID,
  "reason" VARCHAR(500),
  CONSTRAINT "user_contributor_statuses_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "user_contributor_statuses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_contributor_statuses_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "user_contributor_statuses_status_idx"
  ON "user_contributor_statuses"("status");

CREATE TABLE "contributor_status_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "previous_status" "ContributorStatus",
  "new_status" "ContributorStatus" NOT NULL,
  "assigned_by" UUID,
  "reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contributor_status_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contributor_status_audits_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contributor_status_audits_assigned_by_fkey"
    FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "contributor_status_audits_user_id_created_at_idx"
  ON "contributor_status_audits"("user_id", "created_at");
CREATE INDEX "contributor_status_audits_new_status_created_at_idx"
  ON "contributor_status_audits"("new_status", "created_at");

ALTER TABLE "notifications"
  ADD COLUMN "severity" "IncidentSeverity" NOT NULL DEFAULT 'MODERATE',
  ADD COLUMN "read_at" TIMESTAMP(3);

CREATE INDEX "notifications_user_id_read_at_created_at_idx"
  ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_user_id_severity_created_at_idx"
  ON "notifications"("user_id", "severity", "created_at");
CREATE INDEX "notifications_user_id_notification_type_created_at_idx"
  ON "notifications"("user_id", "notification_type", "created_at");
