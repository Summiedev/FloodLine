-- Community submissions remain separate from canonical incidents so moderation,
-- attribution, and future report history can evolve independently.
CREATE TYPE "FloodReportModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FloodReportWaterLevelCategory" AS ENUM (
  'NO_STANDING_WATER',
  'ANKLE_DEEP',
  'KNEE_DEEP',
  'VEHICLE_BONNET',
  'ABOVE_VEHICLE_BONNET'
);

CREATE TABLE "flood_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporter_user_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "report_type" "IncidentType" NOT NULL,
  "location" geography(Point, 4326) NOT NULL,
  "location_name" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "observed_severity" "IncidentSeverity" NOT NULL,
  "water_level_category" "FloodReportWaterLevelCategory",
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "moderation_status" "FloodReportModerationStatus" NOT NULL DEFAULT 'PENDING',
  "source_metadata" JSONB,
  CONSTRAINT "flood_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "flood_reports_reporter_user_id_fkey"
    FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "flood_reports_incident_id_fkey"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "flood_reports_reporter_user_id_created_at_idx"
  ON "flood_reports"("reporter_user_id", "created_at");
CREATE INDEX "flood_reports_incident_id_created_at_idx"
  ON "flood_reports"("incident_id", "created_at");
CREATE INDEX "flood_reports_report_type_created_at_idx"
  ON "flood_reports"("report_type", "created_at");
CREATE INDEX "flood_reports_moderation_status_created_at_idx"
  ON "flood_reports"("moderation_status", "created_at");
CREATE INDEX "flood_reports_location_gist_idx"
  ON "flood_reports" USING GIST ("location");
