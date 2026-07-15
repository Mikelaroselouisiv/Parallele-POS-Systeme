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

export interface ProductVolumePrice {
  id: number;
  productSaleUnitId: number;
  minQuantity: string | number;
  unitPrice: string | number;
  sortOrder: number;
}

export interface PackagingUnit {
  id: number;
  departmentId: number;
  code: string;
  label: string;
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
  /** UUID client pour idempotence (offline / rejeu). */
  clientUuid?: string;
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
  items?: {
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
  }[];
  payments?: SalePaymentRow[];
}

export interface DashboardBalanceSnapshot {
  purchases: number;
  manualExpenses: number;
  /** Revenus (ventes TTC lignes). */
  sales: number;
  /** Sorties d'argent : achats reçus + dépenses manuelles. */
  totalOutflows: number;
  /** Résultat net = ventes − achats − dépenses (positif = excédent). */
  balance: number;
  deficit: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
  trendPct: number | null;
}

export interface DashboardSummaryReport {
  day: DashboardBalanceSnapshot;
  week: DashboardBalanceSnapshot;
  month: DashboardBalanceSnapshot;
}

/** Réglages ticket partagés par département (GET /company/printer). */
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

/** Sous-ensemble de CompanyProfile utilisé pour l'en-tête du ticket (GET /company). */
export interface CompanyProfile {
  id: number;
  name: string;
  address: string;
  phone?: string | null;
  currency: string;
}

export interface InventoryAlertRow {
  id: number;
  name: string;
  sku?: string | null;
  stock: string | number;
  stockMin: string | number;
  department?: { id: number; name: string } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
