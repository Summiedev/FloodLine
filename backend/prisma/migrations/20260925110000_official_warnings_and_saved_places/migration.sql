CREATE TYPE "OfficialWarningStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SavedPlaceType" AS ENUM ('HOME', 'WORK', 'SCHOOL', 'FAMILY', 'CUSTOM');

CREATE TABLE "official_warnings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "authority" VARCHAR(120) NOT NULL,
  "external_id" VARCHAR(255) NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "OfficialWarningStatus" NOT NULL DEFAULT 'ACTIVE',
  "affected_geometry" geometry(Geometry, 4326) NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3),
  "source_url" VARCHAR(2048),
  "raw_provider_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "official_warnings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "official_warnings_authority_external_id_key" UNIQUE ("authority", "external_id"),
  CONSTRAINT "official_warnings_dates_check" CHECK ("effective_at" >= "issued_at"),
  CONSTRAINT "official_warnings_expiry_check" CHECK (
    "expires_at" IS NULL OR "expires_at" >= "effective_at"
  )
);

CREATE INDEX "official_warnings_status_effective_at_expires_at_idx"
  ON "official_warnings"("status", "effective_at", "expires_at");
CREATE INDEX "official_warnings_authority_updated_at_idx"
  ON "official_warnings"("authority", "updated_at");
CREATE INDEX "official_warnings_affected_geometry_gist_idx"
  ON "official_warnings" USING GIST ("affected_geometry");
CREATE INDEX "official_warnings_affected_geometry_geography_gist_idx"
  ON "official_warnings" USING GIST (("affected_geometry"::geography));

CREATE TABLE "saved_places" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "SavedPlaceType" NOT NULL,
  "custom_label" VARCHAR(120),
  "location" geography(Point, 4326) NOT NULL,
  "formatted_address" VARCHAR(500) NOT NULL,
  "provider_place_id" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_places_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_places_custom_label_check" CHECK (
    "type" <> 'CUSTOM' OR ("custom_label" IS NOT NULL AND length(trim("custom_label")) > 0)
  )
);

CREATE INDEX "saved_places_user_id_is_active_updated_at_idx"
  ON "saved_places"("user_id", "is_active", "updated_at");
CREATE INDEX "saved_places_user_id_type_idx"
  ON "saved_places"("user_id", "type");
CREATE INDEX "saved_places_location_gist_idx"
  ON "saved_places" USING GIST ("location");
CREATE UNIQUE INDEX "saved_places_user_standard_type_unique_idx"
  ON "saved_places"("user_id", "type")
  WHERE "type" IN ('HOME', 'WORK', 'SCHOOL');
