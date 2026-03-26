export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_MANAGER' | 'ACCOUNTANT';

export interface SessionUser {
  id: number;
  phone: string;
  email?: string | null;
  role: UserRole;
  fullName?: string | null;
  isActive?: boolean;
  companyId?: number | null;
  departmentId?: number | null;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export type StockMovementKind = 'IN' | 'OUT' | 'ADJUSTMENT';

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'CLOSED' | 'CANCELLED';
export type GoodsReceiptStatus = 'DRAFT' | 'POSTED';

export interface StockMovementRow {
  id: number;
  productId: number;
  quantity: string | number;
  type: StockMovementKind;
  reason: string | null;
  createdAt: string;
  product: {
    id: number;
    name: string;
    saleUnits?: Array<{
      isDefault: boolean;
      labelOverride: string | null;
      packagingUnit: { id: number; code: string; label: string };
    }>;
  };
  createdBy: { id: number; email: string | null } | null;
  inventorySession?: { id: number; label: string | null; departmentId: number } | null;
  goodsReceipt?: { id: number; departmentId: number; status: GoodsReceiptStatus } | null;
}

export type InventorySessionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface InventorySessionListItem {
  id: number;
  departmentId: number;
  status: InventorySessionStatus;
  label: string | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  department: { id: number; name: string; company: { id: number; name: string } };
  _count: { lines: number };
}

export interface InventoryLineRow {
  id: number;
  productId: number;
  systemQtyAtOpen: string | number;
  countedQty: string | number | null;
  note: string | null;
  product: { id: number; name: string; sku?: string | null; stock?: string | number };
}

export interface InventorySessionDetail {
  id: number;
  departmentId: number;
  status: InventorySessionStatus;
  label: string | null;
  note: string | null;
  completedAt: string | null;
  createdAt: string;
  department: { id: number; name: string; company: { id: number; name: string } };
  lines: InventoryLineRow[];
}

export interface PurchaseOrderListItem {
  id: number;
  companyId: number;
  departmentId: number;
  supplierName: string | null;
  status: PurchaseOrderStatus;
  reference: string | null;
  createdAt: string;
  department: { id: number; name: string };
  _count: { lines: number };
}

export interface GoodsReceiptListItem {
  id: number;
  departmentId: number;
  purchaseOrderId: number | null;
  status: GoodsReceiptStatus;
  receivedAt: string;
  createdAt: string;
  department: { id: number; name: string; companyId: number };
  _count: { lines: number };
  purchaseOrder: { id: number; reference: string | null } | null;
}

export interface ProductRecipeDetail {
  id: number;
  parentProductId: number;
  components: Array<{
    id: number;
    componentProductId: number;
    quantityPerParentBaseUnit: string | number;
    componentProduct: { id: number; name: string; sku?: string | null };
  }>;
  parentProduct: { id: number; name: string; isService: boolean };
}

export interface PackagingUnit {
  id: number;
  departmentId: number;
  code: string;
  label: string;
  sortOrder: number;
  department?: {
    id: number;
    name: string;
    companyId: number;
    company?: { id: number; name: string };
  };
}

export interface ProductVolumePrice {
  id: number;
  productSaleUnitId: number;
  minQuantity: string | number;
  unitPrice: string | number;
  sortOrder: number;
}

export interface ProductSaleUnit {
  id: number;
  productId: number;
  packagingUnitId: number;
  labelOverride: string | null;
  unitsPerPackage: string | number;
  salePrice: string | number;
  isDefault: boolean;
  packagingUnit: PackagingUnit;
  volumePrices?: ProductVolumePrice[];
}

export interface Product {
  id: number;
  companyId?: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  isService: boolean;
  trackStock: boolean;
  cost: string | number;
  stock: string | number;
  stockMin: string | number;
  saleUnits: ProductSaleUnit[];
  company?: { id: number; name: string; currency?: string } | null;
  department?: { id: number; name: string } | null;
}

export interface SaleItemPayload {
  productSaleUnitId: number;
  quantity: number;
}

export interface PaymentPayload {
  method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'SPLIT';
  amount: number;
  reference?: string;
}

export interface CreateSalePayload {
  items: SaleItemPayload[];
  payments: PaymentPayload[];
  clientName?: string | null;
}

export interface SalePaymentRow {
  id?: number;
  amount: string | number;
  method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'SPLIT';
  reference?: string | null;
  createdAt?: string;
}

export interface Sale {
  id: number;
  total: number | string;
  subtotal?: number | string;
  tax?: number | string;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
  clientName?: string | null;
  cashier?: string | null;
  userId?: number | null;
  user?: {
    id: number;
    fullName?: string | null;
    phone?: string | null;
    email?: string | null;
    role?: string;
  } | null;
  items?: Array<{
    lineLabel?: string | null;
    quantity: string | number;
    unitPrice: string | number;
    subtotal: string | number;
    product?: {
      id: number;
      name: string;
      companyId?: number;
      departmentId?: number | null;
      department?: { id: number; name?: string } | null;
    };
  }>;
  payments?: SalePaymentRow[];
}

export interface RevenueReport {
  day: number;
  week: number;
  month: number;
}

export interface DashboardBalanceSnapshot {
  purchases: number;
  manualExpenses: number;
  /** Revenus (ventes TTC lignes). */
  sales: number;
  /** Sorties d’argent : achats reçus + dépenses manuelles. */
  totalOutflows: number;
  /** Résultat net = ventes − achats − dépenses (positif = excédent). */
  balance: number;
  deficit: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  trendPct: number | null;
}

export interface DashboardSalesByProductRow {
  departmentId: number | null;
  departmentName: string | null;
  productId: number;
  productName: string;
  isService: boolean;
  quantity: number;
  totalSubtotal: number;
}

export interface DashboardSummaryReport {
  day: DashboardBalanceSnapshot;
  week: DashboardBalanceSnapshot;
  month: DashboardBalanceSnapshot;
}

export interface CompanyProfile {
  id: number;
  name: string;
  legalName?: string | null;
  address: string;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  headerText?: string | null;
  presentationText?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
  currency: string;
  vatRatePercent: string | number;
}

/** Réponse de GET /companies (liste). */
export interface CompanyListItem {
  id: number;
  name: string;
  legalName?: string | null;
  address: string;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  headerText?: string | null;
  presentationText?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
  currency: string;
  vatRatePercent: string | number;
  _count: { products: number; users: number; departments: number };
}

/** Réglages ticket par département (GET/PATCH /company/printer). */
export interface DepartmentPrinterSettings {
  id: number;
  departmentId: number;
  paperWidth: number;
  deviceName: string;
  autoCut: boolean;
  showLogoOnReceipt: boolean;
  receiptHeaderText?: string | null;
  receiptFooterText?: string | null;
  receiptLogoUrl?: string | null;
  previewSampleBody?: string | null;
}

/** Département : mini-périmètre au sein de l’entreprise (produits, stocks rattachés). */
export interface Department {
  id: number;
  companyId: number;
  name: string;
  description?: string | null;
  company?: { id: number; name: string };
}

export interface FinanceEntry {
  id: number;
  type: 'INCOME' | 'EXPENSE';
  amount: string | number;
  description: string;
  createdAt: string;
  user?: { id: number; fullName?: string | null; phone: string } | null;
}

/** GET /finance/ledger — achats (réceptions), ventes (encaissements), dépenses manuelles. */
export interface FinanceLedgerRow {
  kind: 'PURCHASE' | 'SALE' | 'EXPENSE';
  id: string;
  occurredAt: string;
  amount: number;
  description: string;
  user: { id: number; fullName: string | null; phone: string } | null;
}
