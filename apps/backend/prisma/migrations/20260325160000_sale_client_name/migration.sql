-- Sale.clientName : nom client affiché sur tickets + conservé en base.

ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "clientName" TEXT;

