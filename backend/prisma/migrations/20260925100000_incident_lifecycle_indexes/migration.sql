CREATE INDEX "incidents_status_expires_at_idx"
  ON "incidents"("status", "expires_at");

CREATE INDEX "incidents_source_type_status_expires_at_idx"
  ON "incidents"("source_type", "status", "expires_at");

CREATE INDEX "flood_reports_incident_id_moderation_status_created_at_idx"
  ON "flood_reports"("incident_id", "moderation_status", "created_at");
