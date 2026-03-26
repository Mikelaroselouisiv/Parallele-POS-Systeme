-- Connexion par numéro de téléphone : phone unique obligatoire, email optionnel.

UPDATE "User" SET "phone" = 'legacy_' || id::text WHERE "phone" IS NULL OR trim("phone") = '';

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
