ALTER TABLE "Product" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "Product" ADD COLUMN "updatedById" INTEGER;

ALTER TABLE "InventorySession" ADD COLUMN "completedById" INTEGER;
ALTER TABLE "InventorySession" ADD COLUMN "cancelledById" INTEGER;

ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventorySession" ADD CONSTRAINT "InventorySession_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
