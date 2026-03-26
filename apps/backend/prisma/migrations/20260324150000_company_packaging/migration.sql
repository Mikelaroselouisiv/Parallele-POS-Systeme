-- Company, packaging units, product sale units, printer, expense categories, user/department links.

-- Role enum extensions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'STOCK_MANAGER'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'STOCK_MANAGER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel = 'ACCOUNTANT'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';
  END IF;
END $$;

-- Company
CREATE TABLE IF NOT EXISTS "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "headerText" TEXT,
    "presentationText" TEXT,
    "logoUrl" TEXT,
    "taxId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Company" ("name", "address", "currency", "vatRatePercent")
SELECT 'Mon entreprise', '', 'XOF', 0
WHERE NOT EXISTS (SELECT 1 FROM "Company" LIMIT 1);

-- PackagingUnit
CREATE TABLE IF NOT EXISTS "PackagingUnit" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PackagingUnit_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PackagingUnit" ("companyId", "code", "label", "sortOrder")
SELECT c."id", x.code, x.label, x.ord
FROM "Company" c
CROSS JOIN (VALUES
  ('UNIT', 'Unité', 0),
  ('HALF_CASE', 'Demi-caisse', 1),
  ('CASE', 'Caisse', 2),
  ('PALLET', 'Palette', 3)
) AS x(code, label, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM "PackagingUnit" pu WHERE pu."companyId" = c."id" AND pu."code" = x.code
);

CREATE UNIQUE INDEX IF NOT EXISTS "PackagingUnit_companyId_code_key" ON "PackagingUnit"("companyId", "code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PackagingUnit_companyId_fkey'
  ) THEN
    ALTER TABLE "PackagingUnit" ADD CONSTRAINT "PackagingUnit_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Department: company + unique pair
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "description" TEXT;

UPDATE "Department" d SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" LIMIT 1)
WHERE d."companyId" IS NULL;

ALTER TABLE "Department" ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX IF EXISTS "Department_name_key";

ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_name_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_name_key" ON "Department"("companyId", "name");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_companyId_fkey') THEN
    ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Store.companyId
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

UPDATE "Store" s SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" LIMIT 1) WHERE s."companyId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Store_companyId_fkey') THEN
    ALTER TABLE "Store" ADD CONSTRAINT "Store_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- User extensions
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_companyId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_departmentId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "User" u SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" LIMIT 1) WHERE u."companyId" IS NULL;

-- Product extensions + stock decimal
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isService" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockMin" DECIMAL(12,3) NOT NULL DEFAULT 0;

UPDATE "Product" p SET "companyId" = (SELECT "id" FROM "Company" ORDER BY "id" LIMIT 1) WHERE p."companyId" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_companyId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_departmentId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Product" ALTER COLUMN "stock" TYPE DECIMAL(12,3) USING "stock"::decimal;

-- ProductSaleUnit
CREATE TABLE IF NOT EXISTS "ProductSaleUnit" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "packagingUnitId" INTEGER NOT NULL,
    "labelOverride" TEXT,
    "unitsPerPackage" DECIMAL(12,4) NOT NULL,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProductSaleUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductSaleUnit_productId_packagingUnitId_key" ON "ProductSaleUnit"("productId", "packagingUnitId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductSaleUnit_productId_fkey') THEN
    ALTER TABLE "ProductSaleUnit" ADD CONSTRAINT "ProductSaleUnit_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductSaleUnit_packagingUnitId_fkey') THEN
    ALTER TABLE "ProductSaleUnit" ADD CONSTRAINT "ProductSaleUnit_packagingUnitId_fkey"
      FOREIGN KEY ("packagingUnitId") REFERENCES "PackagingUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed ProductSaleUnit from legacy price column (before drop)
INSERT INTO "ProductSaleUnit" ("productId", "packagingUnitId", "unitsPerPackage", "salePrice", "isDefault")
SELECT p."id", pu."id", 1, p."price", true
FROM "Product" p
INNER JOIN "PackagingUnit" pu ON pu."companyId" = p."companyId" AND pu."code" = 'UNIT'
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductSaleUnit" psu WHERE psu."productId" = p."id"
);

ALTER TABLE "Product" DROP COLUMN IF EXISTS "price";

-- SaleItem
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "baseQuantity" DECIMAL(12,4);
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "lineLabel" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "productSaleUnitId" INTEGER;

ALTER TABLE "SaleItem" ALTER COLUMN "quantity" TYPE DECIMAL(12,4) USING "quantity"::decimal;

UPDATE "SaleItem" SET "baseQuantity" = "quantity" WHERE "baseQuantity" IS NULL;

ALTER TABLE "SaleItem" ALTER COLUMN "baseQuantity" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_productSaleUnitId_fkey') THEN
    ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productSaleUnitId_fkey"
      FOREIGN KEY ("productSaleUnitId") REFERENCES "ProductSaleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- StockMovement quantity decimal
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" TYPE DECIMAL(12,4) USING "quantity"::decimal;

-- Expense categories
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_companyId_name_key" ON "ExpenseCategory"("companyId", "name");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExpenseCategory_companyId_fkey') THEN
    ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FinanceEntry_categoryId_fkey') THEN
    ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PrinterSettings (one row per company)
CREATE TABLE IF NOT EXISTS "PrinterSettings" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "paperWidth" INTEGER NOT NULL DEFAULT 58,
    "deviceName" TEXT NOT NULL DEFAULT '',
    "autoCut" BOOLEAN NOT NULL DEFAULT true,
    "showLogoOnReceipt" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PrinterSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PrinterSettings_companyId_key" ON "PrinterSettings"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrinterSettings_companyId_fkey') THEN
    ALTER TABLE "PrinterSettings" ADD CONSTRAINT "PrinterSettings_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "PrinterSettings" ("companyId", "paperWidth", "deviceName", "autoCut", "showLogoOnReceipt")
SELECT c."id", 58, '', true, true FROM "Company" c
WHERE NOT EXISTS (SELECT 1 FROM "PrinterSettings" ps WHERE ps."companyId" = c."id");
