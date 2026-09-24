-- Canonical flood incident storage. Coordinates are longitude/latitude in WGS 84.
CREATE TYPE "IncidentType" AS ENUM (
  'SEVERE_FLOODING',
  'MODERATE_FLOODING',
  'BLOCKED_ROAD',
  'BLOCKED_DRAIN'
);
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'SEVERE');
CREATE TYPE "IncidentStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'EXPIRED', 'REJECTED');
CREATE TYPE "IncidentConfidenceLabel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "IncidentSourceType" AS ENUM ('COMMUNITY', 'OFFICIAL');

CREATE TABLE "incidents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "incident_type" "IncidentType" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'ACTIVE',
  "location" geography(Point, 4326) NOT NULL,
  "affected_geometry" geometry(Geometry, 4326),
  "location_name" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "confidence_score" DECIMAL(4, 3) NOT NULL,
  "confidence_label" "IncidentConfidenceLabel" NOT NULL,
  "source_type" "IncidentSourceType" NOT NULL,
  "confirmation_count" INTEGER NOT NULL DEFAULT 0,
  "photo_count" INTEGER NOT NULL DEFAULT 0,
  "first_reported_at" TIMESTAMP(3) NOT NULL,
  "last_confirmed_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incidents_confidence_score_check" CHECK ("confidence_score" >= 0 AND "confidence_score" <= 1),
  CONSTRAINT "incidents_confirmation_count_check" CHECK ("confirmation_count" >= 0),
  CONSTRAINT "incidents_photo_count_check" CHECK ("photo_count" >= 0),
  CONSTRAINT "incidents_resolved_at_check" CHECK (
    ("status" = 'RESOLVED' AND "resolved_at" IS NOT NULL)
    OR ("status" <> 'RESOLVED')
  )
);

CREATE INDEX "incidents_incident_type_idx" ON "incidents"("incident_type");
CREATE INDEX "incidents_status_idx" ON "incidents"("status");
CREATE INDEX "incidents_severity_idx" ON "incidents"("severity");
CREATE INDEX "incidents_updated_at_idx" ON "incidents"("updated_at");
CREATE INDEX "incidents_location_gist_idx" ON "incidents" USING GIST ("location");
CREATE INDEX "incidents_affected_geometry_gist_idx" ON "incidents" USING GIST ("affected_geometry");
CREATE INDEX "incidents_active_updated_at_idx" ON "incidents"("updated_at")
  WHERE "status" = 'ACTIVE';
