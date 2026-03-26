-- Bases locales encore sur l’ancien schéma (colonne `type` NOT NULL) : suppression idempotente.
-- Le schéma Prisma actuel n’expose plus `Department.type` (rayons libres).

ALTER TABLE "Department" DROP COLUMN IF EXISTS "type";

DROP TYPE IF EXISTS "DepartmentType";
