-- Type d'inventaire : ouverture / clôture de période ou contrôle ponctuel
CREATE TYPE "InventorySessionKind" AS ENUM ('OPENING', 'CLOSING', 'AD_HOC');

ALTER TABLE "InventorySession" ADD COLUMN "kind" "InventorySessionKind" NOT NULL DEFAULT 'AD_HOC';
