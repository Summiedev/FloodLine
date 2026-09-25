-- One confirmation record per user and incident. Reconfirmation updates the
-- existing row after the application cooldown rather than inflating counts.
CREATE TABLE "incident_confirmations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "incident_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_confirmed_at" TIMESTAMP(3),
  "verification_metadata" JSONB,
  CONSTRAINT "incident_confirmations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incident_confirmations_incident_id_user_id_key"
    UNIQUE ("incident_id", "user_id"),
  CONSTRAINT "incident_confirmations_incident_id_fkey"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "incident_confirmations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "incident_confirmations_incident_id_created_at_idx"
  ON "incident_confirmations"("incident_id", "created_at");
CREATE INDEX "incident_confirmations_user_id_created_at_idx"
  ON "incident_confirmations"("user_id", "created_at");
