-- Paliers de prix par quantité ; unité de vente = unité de stock (défaut unitsPerPackage = 1).

CREATE TABLE "ProductVolumePrice" (
    "id" SERIAL NOT NULL,
    "productSaleUnitId" INTEGER NOT NULL,
    "minQuantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVolumePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVolumePrice_productSaleUnitId_minQuantity_key" ON "ProductVolumePrice"("productSaleUnitId", "minQuantity");

ALTER TABLE "ProductVolumePrice" ADD CONSTRAINT "ProductVolumePrice_productSaleUnitId_fkey" FOREIGN KEY ("productSaleUnitId") REFERENCES "ProductSaleUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductSaleUnit" ALTER COLUMN "unitsPerPackage" SET DEFAULT 1;
