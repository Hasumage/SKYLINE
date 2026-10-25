CREATE TABLE "resource_sales" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price" INTEGER NOT NULL,
  "total_price" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_sales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "resource_sales_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "resource_sales_unit_price_check" CHECK ("unit_price" > 0),
  CONSTRAINT "resource_sales_total_price_check" CHECK ("total_price" > 0),
  CONSTRAINT "resource_sales_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_sales_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_sales_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "resource_sales_session_id_idempotency_key_key" ON "resource_sales"("session_id", "idempotency_key");
CREATE INDEX "resource_sales_session_id_team_id_idx" ON "resource_sales"("session_id", "team_id");
