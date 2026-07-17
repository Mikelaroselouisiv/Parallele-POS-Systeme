-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PARTIAL', 'DELIVERED');

-- CreateTable
CREATE TABLE "Delivery" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "saleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveredById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryItem" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "saleItemId" INTEGER NOT NULL,
    "quantityOrdered" DECIMAL(12,4) NOT NULL,
    "quantityDelivered" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Delivery_uuid_key" ON "Delivery"("uuid");
CREATE UNIQUE INDEX "Delivery_saleId_key" ON "Delivery"("saleId");
CREATE INDEX "Delivery_companyId_departmentId_status_idx" ON "Delivery"("companyId", "departmentId", "status");
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

CREATE UNIQUE INDEX "DeliveryItem_uuid_key" ON "DeliveryItem"("uuid");
CREATE UNIQUE INDEX "DeliveryItem_saleItemId_key" ON "DeliveryItem"("saleItemId");
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");

ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: une livraison PENDING pour chaque vente COMPLETED existante
INSERT INTO "Delivery" ("uuid", "saleId", "companyId", "departmentId", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."id",
  COALESCE(
    (
      SELECT p."companyId"
      FROM "SaleItem" si
      JOIN "Product" p ON p."id" = si."productId"
      WHERE si."saleId" = s."id"
      ORDER BY si."id" ASC
      LIMIT 1
    ),
    (
      SELECT u."companyId"
      FROM "User" u
      WHERE u."id" = s."userId"
    )
  ),
  (
    SELECT p."departmentId"
    FROM "SaleItem" si
    JOIN "Product" p ON p."id" = si."productId"
    WHERE si."saleId" = s."id"
    ORDER BY si."id" ASC
    LIMIT 1
  ),
  'PENDING',
  s."createdAt",
  NOW()
FROM "Sale" s
WHERE s."status" = 'COMPLETED'
  AND s."deletedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Delivery" d WHERE d."saleId" = s."id")
  AND COALESCE(
    (
      SELECT p."companyId"
      FROM "SaleItem" si
      JOIN "Product" p ON p."id" = si."productId"
      WHERE si."saleId" = s."id"
      ORDER BY si."id" ASC
      LIMIT 1
    ),
    (
      SELECT u."companyId"
      FROM "User" u
      WHERE u."id" = s."userId"
    )
  ) IS NOT NULL;

INSERT INTO "DeliveryItem" ("uuid", "deliveryId", "saleItemId", "quantityOrdered", "quantityDelivered", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."id",
  si."id",
  si."quantity",
  0,
  si."createdAt",
  NOW()
FROM "Delivery" d
JOIN "SaleItem" si ON si."saleId" = d."saleId"
WHERE NOT EXISTS (SELECT 1 FROM "DeliveryItem" di WHERE di."saleItemId" = si."id");
