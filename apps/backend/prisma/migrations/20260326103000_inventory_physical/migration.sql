-- CreateEnum
CREATE TYPE "InventorySessionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InventorySession" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "status" "InventorySessionStatus" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT,
    "note" TEXT,
    "createdById" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLine" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "systemQtyAtOpen" DECIMAL(12,3) NOT NULL,
    "countedQty" DECIMAL(12,3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "inventorySessionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLine_sessionId_productId_key" ON "InventoryLine"("sessionId", "productId");

-- AddForeignKey
ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryLine" ADD CONSTRAINT "InventoryLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventorySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLine" ADD CONSTRAINT "InventoryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventorySessionId_fkey" FOREIGN KEY ("inventorySessionId") REFERENCES "InventorySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
