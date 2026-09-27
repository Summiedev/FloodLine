-- Active navigation keeps the selected route geometry server-side so incident impact
-- checks can use PostGIS without scanning route coordinates in application memory.
CREATE TYPE "TravelMode" AS ENUM ('DRIVING', 'TRANSIT', 'CYCLING', 'WALKING');
CREATE TYPE "NavigationSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "RouteRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');
CREATE TYPE "NavigationRouteUpdateStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "active_navigation_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "route_fingerprint" VARCHAR(255) NOT NULL,
  "route_geometry" geometry(LineString, 4326) NOT NULL,
  "origin" geography(Point, 4326) NOT NULL,
  "destination" geography(Point, 4326) NOT NULL,
  "travel_mode" "TravelMode" NOT NULL,
  "status" "NavigationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_route_update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_rerouted_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "current_risk_score" DECIMAL(4,3),
  "current_risk_level" "RouteRiskLevel",
  "current_affecting_incident_count" INTEGER NOT NULL DEFAULT 0,
  "current_severe_incident_count" INTEGER NOT NULL DEFAULT 0,
  "route_distance_meters" DOUBLE PRECISION NOT NULL,
  "route_duration_seconds" INTEGER NOT NULL,
  CONSTRAINT "active_navigation_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "active_navigation_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "active_navigation_sessions_route_distance_check"
    CHECK ("route_distance_meters" >= 0),
  CONSTRAINT "active_navigation_sessions_route_duration_check"
    CHECK ("route_duration_seconds" > 0),
  CONSTRAINT "active_navigation_sessions_risk_score_check"
    CHECK ("current_risk_score" IS NULL OR ("current_risk_score" >= 0 AND "current_risk_score" <= 1)),
  CONSTRAINT "active_navigation_sessions_incident_count_check"
    CHECK ("current_affecting_incident_count" >= 0 AND "current_severe_incident_count" >= 0)
);

CREATE INDEX "active_navigation_sessions_user_id_status_expires_at_idx"
  ON "active_navigation_sessions"("user_id", "status", "expires_at");
CREATE INDEX "active_navigation_sessions_status_expires_at_idx"
  ON "active_navigation_sessions"("status", "expires_at");
CREATE INDEX "active_navigation_sessions_route_geometry_gist_idx"
  ON "active_navigation_sessions" USING GIST ("route_geometry");
CREATE INDEX "active_navigation_sessions_route_geography_gist_idx"
  ON "active_navigation_sessions" USING GIST (("route_geometry"::geography));
CREATE INDEX "incidents_affected_geometry_geography_gist_idx"
  ON "incidents" USING GIST (("affected_geometry"::geography));

CREATE TABLE "route_updates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "triggering_incident_id" UUID NOT NULL,
  "previous_route_fingerprint" VARCHAR(255) NOT NULL,
  "new_route_fingerprint" VARCHAR(255) NOT NULL,
  "previous_risk_score" DECIMAL(4,3),
  "new_risk_score" DECIMAL(4,3) NOT NULL,
  "new_risk_level" "RouteRiskLevel" NOT NULL,
  "new_affecting_incident_count" INTEGER NOT NULL,
  "new_severe_incident_count" INTEGER NOT NULL,
  "reason" VARCHAR(100) NOT NULL,
  "route_geometry" geometry(LineString, 4326) NOT NULL,
  "route_distance_meters" DOUBLE PRECISION NOT NULL,
  "route_duration_seconds" INTEGER NOT NULL,
  "status" "NavigationRouteUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "last_error" VARCHAR(2000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "route_updates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "route_updates_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "active_navigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "route_updates_triggering_incident_id_fkey"
    FOREIGN KEY ("triggering_incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "route_updates_new_risk_score_check"
    CHECK ("new_risk_score" >= 0 AND "new_risk_score" <= 1),
  CONSTRAINT "route_updates_incident_count_check"
    CHECK ("new_affecting_incident_count" >= 0 AND "new_severe_incident_count" >= 0),
  CONSTRAINT "route_updates_previous_risk_score_check"
    CHECK ("previous_risk_score" IS NULL OR ("previous_risk_score" >= 0 AND "previous_risk_score" <= 1)),
  CONSTRAINT "route_updates_route_distance_check"
    CHECK ("route_distance_meters" >= 0),
  CONSTRAINT "route_updates_route_duration_check"
    CHECK ("route_duration_seconds" > 0),
  CONSTRAINT "route_updates_session_id_triggering_incident_id_key"
    UNIQUE ("session_id", "triggering_incident_id")
);

CREATE INDEX "route_updates_session_id_created_at_idx"
  ON "route_updates"("session_id", "created_at");
CREATE INDEX "route_updates_status_created_at_idx"
  ON "route_updates"("status", "created_at");
