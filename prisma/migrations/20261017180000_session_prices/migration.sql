ALTER TABLE "resource_types" ADD COLUMN "base_unit_price" INTEGER NOT NULL DEFAULT 0;

UPDATE "resource_types" SET "base_unit_price" = CASE "code"
  WHEN 'HOUSING' THEN 15
  WHEN 'ENERGY' THEN 60
  WHEN 'GAS' THEN 80
  WHEN 'METAL' THEN 140
  WHEN 'WOOD' THEN 20
  WHEN 'COAL' THEN 55
  ELSE "base_unit_price"
END;

CREATE TABLE "object_prices" (
  "session_id" UUID NOT NULL,
  "object_type_id" UUID NOT NULL,
  "current_price" INTEGER NOT NULL,
  CONSTRAINT "object_prices_pkey" PRIMARY KEY ("session_id", "object_type_id"),
  CONSTRAINT "object_prices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "object_prices_object_type_id_fkey" FOREIGN KEY ("object_type_id") REFERENCES "object_types"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "object_prices_current_price_check" CHECK ("current_price" > 0)
);

CREATE TABLE "resource_prices" (
  "session_id" UUID NOT NULL,
  "resource_type_id" UUID NOT NULL,
  "current_unit_price" INTEGER NOT NULL,
  CONSTRAINT "resource_prices_pkey" PRIMARY KEY ("session_id", "resource_type_id"),
  CONSTRAINT "resource_prices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_prices_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "resource_prices_current_unit_price_check" CHECK ("current_unit_price" >= 0)
);

INSERT INTO "object_prices" ("session_id", "object_type_id", "current_price")
SELECT s.id, o.id, o.purchase_base_price + COALESCE(b.quantity, 0) * COALESCE((o.production_rules_json->>'priceStep')::integer, 0)
FROM "game_sessions" s
CROSS JOIN "object_types" o
LEFT JOIN (
  SELECT session_id, object_type_id, SUM(quantity) AS quantity
  FROM "owned_objects" GROUP BY session_id, object_type_id
) b ON b.session_id = s.id AND b.object_type_id = o.id;

INSERT INTO "resource_prices" ("session_id", "resource_type_id", "current_unit_price")
SELECT s.id, r.id, r.base_unit_price
FROM "game_sessions" s CROSS JOIN "resource_types" r;
