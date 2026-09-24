-- Authentication and user-account foundation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "AuthAuditAction" AS ENUM (
  'REGISTERED',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'TOKEN_REFRESHED',
  'TOKEN_REFRESH_FAILED',
  'LOGOUT',
  'PROFILE_UPDATED'
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(320),
  "phone_number" VARCHAR(32),
  "display_name" VARCHAR(80) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_password_credentials" (
  "user_id" UUID NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_password_credentials_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "auth_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "refresh_token_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "ip_address" INET,
  "user_agent" VARCHAR(512),
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "action" "AuthAuditAction" NOT NULL,
  "identity" VARCHAR(320),
  "ip_address" INET,
  "user_agent" VARCHAR(512),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(LOWER("email")) WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_sessions_revoked_at_idx" ON "auth_sessions"("revoked_at");
CREATE INDEX "auth_audit_logs_user_id_created_at_idx" ON "auth_audit_logs"("user_id", "created_at");
CREATE INDEX "auth_audit_logs_action_created_at_idx" ON "auth_audit_logs"("action", "created_at");

ALTER TABLE "users"
  ADD CONSTRAINT "users_at_least_one_identity_check"
  CHECK ("email" IS NOT NULL OR "phone_number" IS NOT NULL);

ALTER TABLE "user_password_credentials"
  ADD CONSTRAINT "user_password_credentials_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_audit_logs"
  ADD CONSTRAINT "auth_audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
