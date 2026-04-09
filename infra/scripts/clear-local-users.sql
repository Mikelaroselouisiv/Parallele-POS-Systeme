-- Supprime tous les utilisateurs (dev local) en respectant les FKs.
BEGIN;
DELETE FROM "Session";
UPDATE "AuditLog" SET "userId" = NULL WHERE "userId" IS NOT NULL;
UPDATE "Sale" SET "userId" = NULL WHERE "userId" IS NOT NULL;
UPDATE "StockMovement" SET "createdById" = NULL WHERE "createdById" IS NOT NULL;
UPDATE "InventorySession" SET "createdById" = NULL WHERE "createdById" IS NOT NULL;
UPDATE "PurchaseOrder" SET "createdById" = NULL WHERE "createdById" IS NOT NULL;
UPDATE "GoodsReceipt" SET "createdById" = NULL WHERE "createdById" IS NOT NULL;
UPDATE "FinanceEntry" SET "userId" = NULL WHERE "userId" IS NOT NULL;
UPDATE "CashClosure" SET "createdById" = NULL WHERE "createdById" IS NOT NULL;
DELETE FROM "User";
COMMIT;
