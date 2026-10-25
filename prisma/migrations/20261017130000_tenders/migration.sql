CREATE TABLE "tenders" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "object_type_code" TEXT,
  "deadline_quarter" INTEGER NOT NULL,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_id" UUID NOT NULL,
  CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tenders_session_id_deadline_quarter_idx" ON "tenders"("session_id", "deadline_quarter");
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tender_requirements" (
  "tender_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "required_units" INTEGER NOT NULL,
  CONSTRAINT "tender_requirements_pkey" PRIMARY KEY ("tender_id", "resource_type_id")
);
ALTER TABLE "tender_requirements" ADD CONSTRAINT "tender_requirements_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_requirements" ADD CONSTRAINT "tender_requirements_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tender_contributions" (
  "id" UUID NOT NULL,
  "tender_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_contributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tender_contributions_tender_id_idempotency_key_key" ON "tender_contributions"("tender_id", "idempotency_key");
CREATE INDEX "tender_contributions_team_id_idx" ON "tender_contributions"("team_id");
ALTER TABLE "tender_contributions" ADD CONSTRAINT "tender_contributions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_contributions" ADD CONSTRAINT "tender_contributions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tender_contributions" ADD CONSTRAINT "tender_contributions_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
