ALTER TABLE "owned_objects"
  ADD COLUMN "unit_price" INTEGER,
  ADD COLUMN "total_price" INTEGER;

CREATE TABLE "loans" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "principal" INTEGER NOT NULL,
  "rate_basis_points" INTEGER NOT NULL,
  "quarters" INTEGER NOT NULL,
  "total_due" INTEGER NOT NULL,
  "remaining" INTEGER NOT NULL,
  "delivery" TEXT NOT NULL,
  "issued_quarter" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loans_session_id_idempotency_key_key" ON "loans"("session_id", "idempotency_key");
CREATE INDEX "loans_session_id_team_id_idx" ON "loans"("session_id", "team_id");
ALTER TABLE "loans" ADD CONSTRAINT "loans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loan_payments" (
  "id" UUID NOT NULL,
  "loan_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "remaining_after" INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loan_payments_loan_id_idempotency_key_key" ON "loan_payments"("loan_id", "idempotency_key");
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
