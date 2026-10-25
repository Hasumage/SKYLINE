ALTER TABLE "loans"
  ADD COLUMN "principal_remaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "accrued_interest" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "interest_through_quarter" INTEGER NOT NULL DEFAULT 0;

UPDATE "loans"
SET "principal_remaining" = LEAST("principal", "remaining"),
    "accrued_interest" = GREATEST(0, "remaining" - "principal"),
    "interest_through_quarter" = "issued_quarter";
