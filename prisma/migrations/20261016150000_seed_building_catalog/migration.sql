INSERT INTO "resource_types" ("id", "code", "label") VALUES
  ('10000000-0000-4000-8000-000000000001', 'ENERGY', 'Энергия'),
  ('10000000-0000-4000-8000-000000000002', 'HOUSING', 'Жильё'),
  ('10000000-0000-4000-8000-000000000003', 'GAS', 'Газ'),
  ('10000000-0000-4000-8000-000000000004', 'METAL', 'Металл'),
  ('10000000-0000-4000-8000-000000000005', 'WOOD', 'Дерево'),
  ('10000000-0000-4000-8000-000000000006', 'COAL', 'Уголь')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "object_types" ("id", "code", "category", "purchase_base_price", "production_rules_json") VALUES
  ('20000000-0000-4000-8000-000000000001', 'HOUSING', 'Жильё', 2000, '{"priceStep":250}'::jsonb),
  ('20000000-0000-4000-8000-000000000002', 'ENERGY', 'Энергетика', 7000, '{"priceStep":500}'::jsonb),
  ('20000000-0000-4000-8000-000000000003', 'GAS', 'Газ', 9000, '{"priceStep":500}'::jsonb),
  ('20000000-0000-4000-8000-000000000004', 'METAL', 'Промышленность', 12000, '{"priceStep":1000}'::jsonb),
  ('20000000-0000-4000-8000-000000000005', 'WOOD', 'Производство', 4000, '{"priceStep":500}'::jsonb),
  ('20000000-0000-4000-8000-000000000006', 'COAL', 'Добыча', 10000, '{"priceStep":500}'::jsonb)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "object_yields" ("object_type_id", "resource_type_id", "units_per_quarter")
SELECT object_type.id, resource_type.id, catalog.units
FROM (VALUES
  ('HOUSING', 'HOUSING', 30),
  ('ENERGY', 'ENERGY', 26),
  ('GAS', 'GAS', 24),
  ('METAL', 'METAL', 18),
  ('WOOD', 'WOOD', 42),
  ('COAL', 'COAL', 35)
) AS catalog(object_code, resource_code, units)
JOIN "object_types" AS object_type ON object_type.code = catalog.object_code
JOIN "resource_types" AS resource_type ON resource_type.code = catalog.resource_code
ON CONFLICT ("object_type_id", "resource_type_id") DO NOTHING;
