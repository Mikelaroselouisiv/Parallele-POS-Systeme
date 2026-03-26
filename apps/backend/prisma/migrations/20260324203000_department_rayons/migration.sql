-- Rayons magasin : plus de type administratif, uniquement nom + description libre.

-- DropForeignKey (none on type column)

ALTER TABLE "Department" DROP COLUMN IF EXISTS "type";

DROP TYPE IF EXISTS "DepartmentType";
