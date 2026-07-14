/**
 * Entités syncées dans l’ordre (dépendances FK locales approximatives).
 * Les payloads portent déjà les FK Int du nœud source — le push vers l’autre
 * nœud ne fonctionne pleinement qu’après bootstrap / même dataset.
 * V1 : transporte uuid + data ; résolution FK uuid→id = évolution ultérieure.
 */
export const ENTITY_ORDER = [
  'Company',
  'Department',
  'DepartmentPrinterProfile',
  'PackagingUnit',
  'Store',
  'Register',
  'User',
  'ExpenseCategory',
  'Product',
  'ProductSaleUnit',
  'ProductVolumePrice',
  'ProductRecipe',
  'RecipeComponent',
  'Sale',
  'SaleItem',
  'Payment',
  'StockMovement',
  'FinanceEntry',
  'InventorySession',
  'InventoryLine',
  'PurchaseOrder',
  'PurchaseOrderLine',
  'GoodsReceipt',
  'GoodsReceiptLine',
  'CashClosure',
  'AuditLog',
];
