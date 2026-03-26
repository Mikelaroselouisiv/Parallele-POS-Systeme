-- Lier chaque encaissement POS (FinanceEntry INCOME) à la vente pour journal cohérent avec la caisse.

ALTER TABLE "FinanceEntry" ADD COLUMN IF NOT EXISTS "saleId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceEntry_saleId_key" ON "FinanceEntry"("saleId");

ALTER TABLE "FinanceEntry" DROP CONSTRAINT IF EXISTS "FinanceEntry_saleId_fkey";

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
