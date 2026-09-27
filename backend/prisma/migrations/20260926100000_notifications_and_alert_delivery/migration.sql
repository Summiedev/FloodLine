CREATE TYPE "NotificationChannel" AS ENUM ('APP_PUSH', 'SMS', 'WHATSAPP');
CREATE TYPE "NotificationEndpointStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'OTHER');
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('NOT_CONNECTED', 'PENDING', 'VERIFIED', 'REVOKED');
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('PHONE', 'WHATSAPP');
CREATE TYPE "NotificationType" AS ENUM ('INCIDENT_ALERT', 'OFFICIAL_WARNING');
CREATE TYPE "NotificationState" AS ENUM ('PENDING', 'DELIVERING', 'SENT', 'PARTIAL', 'SKIPPED', 'FAILED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERING', 'SENT', 'FAILED', 'DEAD_LETTER', 'SKIPPED');

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_key"
  ON "notification_preferences"("user_id", "channel");
CREATE INDEX "notification_preferences_user_id_enabled_idx"
  ON "notification_preferences"("user_id", "enabled");

CREATE TABLE "notification_endpoints" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "destination_hash" VARCHAR(128) NOT NULL,
  "status" "NotificationEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_endpoints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_endpoints_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_endpoints_user_channel_destination_key"
  ON "notification_endpoints"("user_id", "channel", "destination_hash");
CREATE INDEX "notification_endpoints_user_channel_status_idx"
  ON "notification_endpoints"("user_id", "channel", "status");

CREATE TABLE "device_registrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "endpoint_id" UUID NOT NULL,
  "token_secret" VARCHAR(2048) NOT NULL,
  "platform" "DevicePlatform" NOT NULL,
  "app_version" VARCHAR(64),
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_registrations_endpoint_id_key" UNIQUE ("endpoint_id"),
  CONSTRAINT "device_registrations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_registrations_endpoint_id_fkey"
    FOREIGN KEY ("endpoint_id") REFERENCES "notification_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "device_registrations_user_id_revoked_at_last_seen_at_idx"
  ON "device_registrations"("user_id", "revoked_at", "last_seen_at");

CREATE TABLE "messaging_destinations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "sms_endpoint_id" UUID NOT NULL,
  "whatsapp_endpoint_id" UUID NOT NULL,
  "phone_number" VARCHAR(16) NOT NULL,
  "phone_verified_at" TIMESTAMP(3),
  "whatsapp_status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
  "whatsapp_verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_destinations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_destinations_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "messaging_destinations_sms_endpoint_id_key" UNIQUE ("sms_endpoint_id"),
  CONSTRAINT "messaging_destinations_whatsapp_endpoint_id_key" UNIQUE ("whatsapp_endpoint_id"),
  CONSTRAINT "messaging_destinations_phone_number_key" UNIQUE ("phone_number"),
  CONSTRAINT "messaging_destinations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_destinations_sms_endpoint_id_fkey"
    FOREIGN KEY ("sms_endpoint_id") REFERENCES "notification_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_destinations_whatsapp_endpoint_id_fkey"
    FOREIGN KEY ("whatsapp_endpoint_id") REFERENCES "notification_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "messaging_destinations_phone_verified_at_idx"
  ON "messaging_destinations"("phone_verified_at");
CREATE INDEX "messaging_destinations_whatsapp_status_idx"
  ON "messaging_destinations"("whatsapp_status");

CREATE TABLE "phone_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "destination_id" UUID NOT NULL,
  "purpose" "PhoneVerificationPurpose" NOT NULL,
  "code_hash" VARCHAR(128) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "phone_verifications_attempt_count_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= "max_attempts"),
  CONSTRAINT "phone_verifications_max_attempts_check" CHECK ("max_attempts" > 0),
  CONSTRAINT "phone_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "phone_verifications_destination_id_fkey"
    FOREIGN KEY ("destination_id") REFERENCES "messaging_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "phone_verifications_user_id_purpose_created_at_idx"
  ON "phone_verifications"("user_id", "purpose", "created_at");
CREATE INDEX "phone_verifications_destination_id_purpose_expires_at_idx"
  ON "phone_verifications"("destination_id", "purpose", "expires_at");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "incident_id" UUID,
  "official_warning_id" UUID,
  "saved_place_id" UUID,
  "notification_type" "NotificationType" NOT NULL,
  "dedupe_key" VARCHAR(512) NOT NULL,
  "trigger_key" VARCHAR(128) NOT NULL,
  "escalation_level" INTEGER NOT NULL DEFAULT 0,
  "title" VARCHAR(300) NOT NULL,
  "body" TEXT NOT NULL,
  "template_parameters" JSONB,
  "state" "NotificationState" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_dedupe_key_key" UNIQUE ("dedupe_key"),
  CONSTRAINT "notifications_escalation_level_check" CHECK ("escalation_level" >= 0),
  CONSTRAINT "notifications_one_source_check" CHECK (
    (CASE WHEN "incident_id" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "official_warning_id" IS NULL THEN 0 ELSE 1 END) = 1
  ),
  CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_incident_id_fkey"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_official_warning_id_fkey"
    FOREIGN KEY ("official_warning_id") REFERENCES "official_warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_saved_place_id_fkey"
    FOREIGN KEY ("saved_place_id") REFERENCES "saved_places"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_incident_id_user_id_escalation_level_idx"
  ON "notifications"("incident_id", "user_id", "escalation_level");
CREATE INDEX "notifications_official_warning_id_user_id_escalation_level_idx"
  ON "notifications"("official_warning_id", "user_id", "escalation_level");
CREATE INDEX "notifications_state_updated_at_idx"
  ON "notifications"("state", "updated_at");

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "notification_id" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "provider_message_id" VARCHAR(255),
  "last_error" VARCHAR(2000),
  "next_attempt_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_notification_id_channel_key" UNIQUE ("notification_id", "channel"),
  CONSTRAINT "notification_deliveries_attempt_count_check" CHECK ("attempt_count" >= 0),
  CONSTRAINT "notification_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx"
  ON "notification_deliveries"("status", "next_attempt_at");
CREATE INDEX "notification_deliveries_notification_id_status_idx"
  ON "notification_deliveries"("notification_id", "status");
