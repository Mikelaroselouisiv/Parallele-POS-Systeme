-- PackagingUnit: scope by department (conditionnement par département).

-- 1. Add column
ALTER TABLE "PackagingUnit" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;

-- 2. Ensure each company has at least one department
INSERT INTO "Department" ("companyId", "name", "createdAt")
SELECT c."id", 'Principal', CURRENT_TIMESTAMP
FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "Department" d WHERE d."companyId" = c."id");

-- 3. Point all existing packaging rows to the first department of their company
UPDATE "PackagingUnit" pu
SET "departmentId" = sub."id"
FROM (
  SELECT d."id", d."companyId"
  FROM "Department" d
  INNER JOIN (
    SELECT "companyId", MIN("id") AS "firstId"
    FROM "Department"
    GROUP BY "companyId"
  ) x ON x."firstId" = d."id"
) sub
WHERE pu."companyId" = sub."companyId";

-- 4. Duplicate conditionnements for every non-primary department (same codes / labels)
INSERT INTO "PackagingUnit" ("departmentId", "code", "label", "sortOrder")
SELECT d."id", pu."code", pu."label", pu."sortOrder"
FROM "Department" d
INNER JOIN (
  SELECT "companyId", MIN("id") AS "firstId"
  FROM "Department"
  GROUP BY "companyId"
) fm ON fm."companyId" = d."companyId"
INNER JOIN "Department" d_first ON d_first."id" = fm."firstId"
INNER JOIN "PackagingUnit" pu ON pu."departmentId" = d_first."id"
WHERE d."id" <> d_first."id"
  AND NOT EXISTS (
    SELECT 1 FROM "PackagingUnit" ex
    WHERE ex."departmentId" = d."id" AND ex."code" = pu."code"
  );

-- 5. Repoint sale units so products use the packaging row matching their department (same code)
-- (psu cannot appear in JOIN ... ON with FROM in PostgreSQL — tie pu_old to psu in WHERE instead.)
UPDATE "ProductSaleUnit" AS psu
SET "packagingUnitId" = pu_new."id"
FROM "Product" AS p,
     "PackagingUnit" AS pu_old,
     "PackagingUnit" AS pu_new
WHERE psu."productId" = p."id"
  AND p."departmentId" IS NOT NULL
  AND pu_old."id" = psu."packagingUnitId"
  AND pu_new."departmentId" = p."departmentId"
  AND pu_new."code" = pu_old."code";

-- 6. Drop company scope: FK and column
ALTER TABLE "PackagingUnit" DROP CONSTRAINT IF EXISTS "PackagingUnit_companyId_fkey";
DROP INDEX IF EXISTS "PackagingUnit_companyId_code_key";
ALTER TABLE "PackagingUnit" DROP COLUMN IF EXISTS "companyId";

ALTER TABLE "PackagingUnit" ALTER COLUMN "departmentId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackagingUnit_departmentId_fkey') THEN
    ALTER TABLE "PackagingUnit" ADD CONSTRAINT "PackagingUnit_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PackagingUnit_departmentId_code_key" ON "PackagingUnit"("departmentId", "code");
