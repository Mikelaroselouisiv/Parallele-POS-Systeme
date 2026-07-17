-- Réintégration du stock pour la part non encore livrée des ventes COMPLETED.
-- Avant ce changement, la sortie se faisait à l’encaissement ; désormais à la livraison.
-- On restaure uniquement (commandé − livré) pour les produits trackStock non-service.

WITH undelivered AS (
  SELECT
    si."productId" AS "productId",
    SUM(
      (di."quantityOrdered" - di."quantityDelivered")
      * (si."baseQuantity" / NULLIF(si."quantity", 0))
    ) AS qty
  FROM "DeliveryItem" di
  JOIN "Delivery" d ON d."id" = di."deliveryId"
  JOIN "Sale" s ON s."id" = d."saleId"
  JOIN "SaleItem" si ON si."id" = di."saleItemId"
  JOIN "Product" p ON p."id" = si."productId"
  WHERE s."status" = 'COMPLETED'
    AND s."deletedAt" IS NULL
    AND d."deletedAt" IS NULL
    AND p."trackStock" = true
    AND p."isService" = false
    AND di."quantityOrdered" > di."quantityDelivered"
  GROUP BY si."productId"
  HAVING SUM(
    (di."quantityOrdered" - di."quantityDelivered")
    * (si."baseQuantity" / NULLIF(si."quantity", 0))
  ) > 0
)
UPDATE "Product" p
SET
  "stock" = p."stock" + u.qty,
  "updatedAt" = NOW()
FROM undelivered u
WHERE p."id" = u."productId";

INSERT INTO "StockMovement" ("uuid", "productId", "quantity", "type", "reason", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."productId",
  u.qty,
  'IN',
  'Réintégration stock — bascule sortie à la livraison',
  NOW(),
  NOW()
FROM (
  SELECT
    si."productId" AS "productId",
    SUM(
      (di."quantityOrdered" - di."quantityDelivered")
      * (si."baseQuantity" / NULLIF(si."quantity", 0))
    ) AS qty
  FROM "DeliveryItem" di
  JOIN "Delivery" d ON d."id" = di."deliveryId"
  JOIN "Sale" s ON s."id" = d."saleId"
  JOIN "SaleItem" si ON si."id" = di."saleItemId"
  JOIN "Product" p ON p."id" = si."productId"
  WHERE s."status" = 'COMPLETED'
    AND s."deletedAt" IS NULL
    AND d."deletedAt" IS NULL
    AND p."trackStock" = true
    AND p."isService" = false
    AND di."quantityOrdered" > di."quantityDelivered"
  GROUP BY si."productId"
  HAVING SUM(
    (di."quantityOrdered" - di."quantityDelivered")
    * (si."baseQuantity" / NULLIF(si."quantity", 0))
  ) > 0
) u;
