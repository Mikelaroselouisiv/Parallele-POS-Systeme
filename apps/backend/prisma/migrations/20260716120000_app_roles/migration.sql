-- Rôles dynamiques + User.role en texte (plus d'enum Prisma)

CREATE TABLE "AppRole" (
  "id" SERIAL NOT NULL,
  "uuid" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppRole_uuid_key" ON "AppRole"("uuid");
CREATE UNIQUE INDEX "AppRole_code_key" ON "AppRole"("code");

INSERT INTO "AppRole" ("uuid", "code", "label", "description", "permissions", "isSystem", "isActive", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'ADMIN', 'Administrateur', 'Accès complet au système', ARRAY['*']::TEXT[], true, true, NOW()),
  (gen_random_uuid()::text, 'MANAGER', 'Gérant', 'Gestion quotidienne du point de vente', ARRAY[
    'pos.use','stock.view','stock.manage','products.view','products.manage','inventory.physical',
    'purchasing.manage','sales.create','sales.view','sales.cancel','config.view','config.manage',
    'company.manage','departments.manage','packaging.manage','printer.manage','recipes.manage','users.view'
  ]::TEXT[], true, true, NOW()),
  (gen_random_uuid()::text, 'CASHIER', 'Caissier', 'Caisse et ventes', ARRAY[
    'pos.use','products.view','sales.create','sales.view','config.view'
  ]::TEXT[], true, true, NOW()),
  (gen_random_uuid()::text, 'STOCK_MANAGER', 'Responsable stock', 'Stock, achats et catalogue', ARRAY[
    'stock.view','stock.manage','products.view','products.manage','inventory.physical',
    'purchasing.manage','recipes.manage','packaging.manage','config.view'
  ]::TEXT[], true, true, NOW()),
  (gen_random_uuid()::text, 'ACCOUNTANT', 'Comptable', 'Finance, rapports et audit', ARRAY[
    'dashboard.view','reports.view','finance.view','finance.write','audit.view','sales.view','stock.view'
  ]::TEXT[], true, true, NOW());

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CASHIER';

DROP TYPE "Role";
