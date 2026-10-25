ALTER TABLE "owned_objects"
  ADD COLUMN "first_production_quarter" INTEGER;

UPDATE "owned_objects"
SET "first_production_quarter" = "built_in_quarter";

ALTER TABLE "owned_objects"
  ALTER COLUMN "first_production_quarter" SET NOT NULL,
  ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "owned_objects_session_id_idempotency_key_key"
  ON "owned_objects"("session_id", "idempotency_key");

CREATE TABLE "object_yields" (
  "object_type_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "units_per_quarter" INTEGER NOT NULL,
  CONSTRAINT "object_yields_pkey" PRIMARY KEY ("object_type_id", "resource_type_id"),
  CONSTRAINT "object_yields_object_type_id_fkey" FOREIGN KEY ("object_type_id") REFERENCES "object_types"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "object_yields_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "object_yields_units_positive" CHECK ("units_per_quarter" > 0)
);

CREATE TABLE "resource_stocks" (
  "session_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "resource_stocks_pkey" PRIMARY KEY ("session_id", "team_id", "resource_type_id"),
  CONSTRAINT "resource_stocks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_stocks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_stocks_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "resource_stocks_quantity_nonnegative" CHECK ("quantity" >= 0)
);

CREATE INDEX "resource_stocks_team_id_idx" ON "resource_stocks"("team_id");
CREATE UNIQUE INDEX "production_lines_quarter_run_id_team_id_resource_type_id_key"
  ON "production_lines"("quarter_run_id", "team_id", "resource_type_id");

ALTER TABLE "owned_objects" ADD CONSTRAINT "owned_objects_quantity_positive" CHECK ("quantity" > 0);
