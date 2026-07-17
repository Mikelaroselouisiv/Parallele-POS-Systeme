-- CreateEnum
CREATE TYPE "RegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "RegisterSession" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "registerId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "status" "RegisterSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "closedAt" TIMESTAMP(3),
    "openingCashAmount" DECIMAL(12,2),
    "closingCashExpected" DECIMAL(12,2),
    "closingCashCounted" DECIMAL(12,2),
    "cashVariance" DECIMAL(12,2),
    "openingInventorySessionId" INTEGER NOT NULL,
    "closingInventorySessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RegisterSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegisterSession_uuid_key" ON "RegisterSession"("uuid");
CREATE UNIQUE INDEX "RegisterSession_openingInventorySessionId_key" ON "RegisterSession"("openingInventorySessionId");
CREATE UNIQUE INDEX "RegisterSession_closingInventorySessionId_key" ON "RegisterSession"("closingInventorySessionId");

ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_openingInventorySessionId_fkey" FOREIGN KEY ("openingInventorySessionId") REFERENCES "InventorySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_closingInventorySessionId_fkey" FOREIGN KEY ("closingInventorySessionId") REFERENCES "InventorySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
