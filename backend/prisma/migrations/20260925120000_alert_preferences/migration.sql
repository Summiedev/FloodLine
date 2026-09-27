CREATE TABLE "alert_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "saved_place_id" UUID,
  "radius_meters" INTEGER NOT NULL DEFAULT 1000,
  "incident_types" "IncidentType"[] NOT NULL DEFAULT ARRAY[
    'SEVERE_FLOODING'::"IncidentType",
    'MODERATE_FLOODING'::"IncidentType",
    'BLOCKED_ROAD'::"IncidentType",
    'BLOCKED_DRAIN'::"IncidentType"
  ],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alert_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "alert_preferences_saved_place_id_fkey"
    FOREIGN KEY ("saved_place_id") REFERENCES "saved_places"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "alert_preferences_radius_check" CHECK ("radius_meters" > 0),
  CONSTRAINT "alert_preferences_severe_flooding_check" CHECK (
    'SEVERE_FLOODING'::"IncidentType" = ANY("incident_types")
  )
);

CREATE INDEX "alert_preferences_user_id_saved_place_id_idx"
  ON "alert_preferences"("user_id", "saved_place_id");
CREATE INDEX "alert_preferences_saved_place_id_idx"
  ON "alert_preferences"("saved_place_id");
CREATE UNIQUE INDEX "alert_preferences_default_user_unique_idx"
  ON "alert_preferences"("user_id")
  WHERE "saved_place_id" IS NULL;
CREATE UNIQUE INDEX "alert_preferences_user_saved_place_unique_idx"
  ON "alert_preferences"("user_id", "saved_place_id")
  WHERE "saved_place_id" IS NOT NULL;
