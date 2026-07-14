-- Sync foundation: UUID identity, updatedAt, soft delete, SyncState, Sale.clientUuid
-- PK Int preserved for API compatibility.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SyncDirection enum + SyncState
DO $$ BEGIN
  CREATE TYPE "SyncDirection" AS ENUM ('PULL', 'PUSH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "SyncState" (
    "id" SERIAL NOT NULL,
    "remoteNodeId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "lastCursorAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyncState_remoteNodeId_entity_direction_key"
  ON "SyncState"("remoteNodeId", "entity", "direction");
CREATE INDEX IF NOT EXISTS "SyncState_remoteNodeId_entity_idx"
  ON "SyncState"("remoteNodeId", "entity");

-- Helper: add uuid / updatedAt / deletedAt to a table if missing
-- Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Company" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Company" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Company_uuid_key" ON "Company"("uuid");

-- PackagingUnit
ALTER TABLE "PackagingUnit" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "PackagingUnit" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PackagingUnit" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PackagingUnit" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "PackagingUnit" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "PackagingUnit" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "PackagingUnit" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "PackagingUnit_uuid_key" ON "PackagingUnit"("uuid");

-- Department
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Department" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Department" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Department" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Department_uuid_key" ON "Department"("uuid");

-- DepartmentPrinterProfile
ALTER TABLE "DepartmentPrinterProfile" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "DepartmentPrinterProfile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "DepartmentPrinterProfile" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "DepartmentPrinterProfile" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "DepartmentPrinterProfile" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentPrinterProfile_uuid_key" ON "DepartmentPrinterProfile"("uuid");

-- Store
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Store" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Store" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Store" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Store_uuid_key" ON "Store"("uuid");

-- Register
ALTER TABLE "Register" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Register" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Register" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Register" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Register" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Register" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Register_uuid_key" ON "Register"("uuid");

-- Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Product" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Product_uuid_key" ON "Product"("uuid");

-- ProductSaleUnit
ALTER TABLE "ProductSaleUnit" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "ProductSaleUnit" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductSaleUnit" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductSaleUnit" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "ProductSaleUnit" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "ProductSaleUnit" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "ProductSaleUnit" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductSaleUnit_uuid_key" ON "ProductSaleUnit"("uuid");

-- ProductVolumePrice
ALTER TABLE "ProductVolumePrice" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "ProductVolumePrice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductVolumePrice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductVolumePrice" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "ProductVolumePrice" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "ProductVolumePrice" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "ProductVolumePrice" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductVolumePrice_uuid_key" ON "ProductVolumePrice"("uuid");

-- Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "clientUuid" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Sale" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_uuid_key" ON "Sale"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_clientUuid_key" ON "Sale"("clientUuid");

-- SaleItem
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "SaleItem" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "SaleItem" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "SaleItem" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "SaleItem_uuid_key" ON "SaleItem"("uuid");

-- Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "Payment" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_uuid_key" ON "Payment"("uuid");

-- StockMovement
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "StockMovement" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_uuid_key" ON "StockMovement"("uuid");

-- InventorySession
ALTER TABLE "InventorySession" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "InventorySession" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "InventorySession" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "InventorySession" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "InventorySession" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "InventorySession_uuid_key" ON "InventorySession"("uuid");

-- InventoryLine
ALTER TABLE "InventoryLine" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "InventoryLine" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "InventoryLine" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "InventoryLine" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "InventoryLine" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLine_uuid_key" ON "InventoryLine"("uuid");

-- PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "PurchaseOrder" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_uuid_key" ON "PurchaseOrder"("uuid");

-- PurchaseOrderLine
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "PurchaseOrderLine" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "PurchaseOrderLine" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrderLine_uuid_key" ON "PurchaseOrderLine"("uuid");

-- GoodsReceipt
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "GoodsReceipt" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "GoodsReceipt" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "GoodsReceipt" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceipt_uuid_key" ON "GoodsReceipt"("uuid");

-- GoodsReceiptLine
ALTER TABLE "GoodsReceiptLine" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "GoodsReceiptLine" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "GoodsReceiptLine" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "GoodsReceiptLine" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "GoodsReceiptLine" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "GoodsReceiptLine" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceiptLine_uuid_key" ON "GoodsReceiptLine"("uuid");

-- ProductRecipe
ALTER TABLE "ProductRecipe" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "ProductRecipe" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductRecipe" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductRecipe" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "ProductRecipe" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "ProductRecipe" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "ProductRecipe" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductRecipe_uuid_key" ON "ProductRecipe"("uuid");

-- RecipeComponent
ALTER TABLE "RecipeComponent" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "RecipeComponent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RecipeComponent" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RecipeComponent" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "RecipeComponent" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "RecipeComponent" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "RecipeComponent" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "RecipeComponent_uuid_key" ON "RecipeComponent"("uuid");

-- ExpenseCategory
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ExpenseCategory" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "ExpenseCategory" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "ExpenseCategory" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "ExpenseCategory" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_uuid_key" ON "ExpenseCategory"("uuid");

-- FinanceEntry
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "FinanceEntry" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "FinanceEntry" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "FinanceEntry" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceEntry_uuid_key" ON "FinanceEntry"("uuid");

-- CashClosure
ALTER TABLE "CashClosure" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "CashClosure" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CashClosure" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "CashClosure" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "CashClosure" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "CashClosure" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "CashClosure_uuid_key" ON "CashClosure"("uuid");

-- User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
UPDATE "User" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "User" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "User_uuid_key" ON "User"("uuid");

-- AuditLog (append-only sync; no soft delete)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "uuid" TEXT;
UPDATE "AuditLog" SET "uuid" = gen_random_uuid()::text WHERE "uuid" IS NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "uuid" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "uuid" SET DEFAULT gen_random_uuid()::text;
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_uuid_key" ON "AuditLog"("uuid");
