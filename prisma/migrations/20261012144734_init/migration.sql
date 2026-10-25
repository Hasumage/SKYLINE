-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'WAITING', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "CredentialPurpose" AS ENUM ('PLAYER_JOIN', 'STAFF_LOGIN', 'PUBLIC_DISPLAY');

-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('BANK', 'CONSTRUCTION', 'ATM', 'PATENT_OFFICE', 'MEDICINE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ORGANIZER', 'GAME_MASTER', 'PLAYER', 'PUBLIC_DISPLAY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "QuarterRunStatus" AS ENUM ('STARTED', 'COMMITTED', 'FAILED');

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "current_quarter" INTEGER NOT NULL DEFAULT 0,
    "quarter_duration_sec" INTEGER NOT NULL DEFAULT 360,
    "starts_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "config_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "join_credentials" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "purpose" "CredentialPurpose" NOT NULL,
    "station_type" "StationType",
    "secret_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "uses_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "join_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "team_id" UUID,
    "display_name" TEXT,
    "session_token_hash" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "electronic_balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_sessions" (
    "id" UUID NOT NULL,
    "game_session_id" UUID NOT NULL,
    "station_type" "StationType" NOT NULL,
    "credential_id" UUID NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_readiness" (
    "session_id" UUID NOT NULL,
    "station_type" "StationType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "station_readiness_pkey" PRIMARY KEY ("session_id","station_type")
);

-- CreateTable
CREATE TABLE "session_config" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purchase_base_price" INTEGER NOT NULL,
    "production_rules_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "object_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owned_objects" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "object_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "built_in_quarter" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owned_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_types" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "resource_type_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "params_json" JSONB NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarter_runs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "quarter_number" INTEGER NOT NULL,
    "status" "QuarterRunStatus" NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "quarter_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" UUID NOT NULL,
    "quarter_run_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "resource_type_id" UUID NOT NULL,
    "produced_units" INTEGER NOT NULL,
    "consumed_units" INTEGER NOT NULL DEFAULT 0,
    "sold_units" INTEGER NOT NULL DEFAULT 0,
    "unit_price" INTEGER NOT NULL,
    "revenue" INTEGER NOT NULL,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "quarter_run_id" UUID,
    "operation_type" TEXT NOT NULL,
    "amount_signed" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "join_credentials_session_id_idx" ON "join_credentials"("session_id");

-- CreateIndex
CREATE INDEX "join_credentials_secret_hash_idx" ON "join_credentials"("secret_hash");

-- CreateIndex
CREATE UNIQUE INDEX "participants_session_token_hash_key" ON "participants"("session_token_hash");

-- CreateIndex
CREATE INDEX "participants_session_id_idx" ON "participants"("session_id");

-- CreateIndex
CREATE INDEX "participants_team_id_idx" ON "participants"("team_id");

-- CreateIndex
CREATE INDEX "teams_session_id_idx" ON "teams"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_session_id_name_key" ON "teams"("session_id", "name");

-- CreateIndex
CREATE INDEX "staff_sessions_game_session_id_idx" ON "staff_sessions"("game_session_id");

-- CreateIndex
CREATE INDEX "session_config_session_id_idx" ON "session_config"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_config_session_id_version_key" ON "session_config"("session_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "object_types_code_key" ON "object_types"("code");

-- CreateIndex
CREATE INDEX "owned_objects_session_id_idx" ON "owned_objects"("session_id");

-- CreateIndex
CREATE INDEX "owned_objects_team_id_idx" ON "owned_objects"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_types_code_key" ON "resource_types"("code");

-- CreateIndex
CREATE INDEX "price_rules_session_id_idx" ON "price_rules"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_rules_session_id_resource_type_id_version_key" ON "price_rules"("session_id", "resource_type_id", "version");

-- CreateIndex
CREATE INDEX "quarter_runs_session_id_idx" ON "quarter_runs"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarter_runs_session_id_quarter_number_key" ON "quarter_runs"("session_id", "quarter_number");

-- CreateIndex
CREATE INDEX "production_lines_team_id_idx" ON "production_lines"("team_id");

-- CreateIndex
CREATE INDEX "ledger_entries_session_id_idx" ON "ledger_entries"("session_id");

-- CreateIndex
CREATE INDEX "ledger_entries_team_id_idx" ON "ledger_entries"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_session_id_operation_type_idempotency_key_key" ON "ledger_entries"("session_id", "operation_type", "idempotency_key");

-- CreateIndex
CREATE INDEX "audit_events_session_id_idx" ON "audit_events"("session_id");

-- AddForeignKey
ALTER TABLE "join_credentials" ADD CONSTRAINT "join_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_game_session_id_fkey" FOREIGN KEY ("game_session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "join_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_readiness" ADD CONSTRAINT "station_readiness_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_config" ADD CONSTRAINT "session_config_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_objects" ADD CONSTRAINT "owned_objects_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owned_objects" ADD CONSTRAINT "owned_objects_object_type_id_fkey" FOREIGN KEY ("object_type_id") REFERENCES "object_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_runs" ADD CONSTRAINT "quarter_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_quarter_run_id_fkey" FOREIGN KEY ("quarter_run_id") REFERENCES "quarter_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_lines" ADD CONSTRAINT "production_lines_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_quarter_run_id_fkey" FOREIGN KEY ("quarter_run_id") REFERENCES "quarter_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
