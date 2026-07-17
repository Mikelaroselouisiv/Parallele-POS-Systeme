-- Devise par défaut : gourdes haïtiennes (HTG), pas XOF (legacy migration).
UPDATE "Company"
SET "currency" = 'HTG'
WHERE "currency" IS NULL OR TRIM("currency") = '' OR "currency" = 'XOF';

ALTER TABLE "Company" ALTER COLUMN "currency" SET DEFAULT 'HTG';
