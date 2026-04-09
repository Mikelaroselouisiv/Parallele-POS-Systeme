import axios from 'axios';
import type {
  CompanyListItem,
  CompanyProfile,
  CreateSalePayload,
  DashboardBalanceSnapshot,
  DashboardSalesByProductRow,
  DashboardSummaryReport,
  Department,
  FinanceEntry,
  FinanceLedgerRow,
  LoginResponse,
  PackagingUnit,
  DepartmentPrinterSettings,
  Product,
  RevenueReport,
  Sale,
  SessionUser,
  StockMovementRow,
  InventorySessionDetail,
  InventorySessionListItem,
  GoodsReceiptListItem,
  ProductRecipeDetail,
  PurchaseOrderListItem,
} from '../types/api';
import { PUBLIC_API_BASE_URL } from '../config/public-api';

/** Prod (build) : `PUBLIC_API_BASE_URL` ; dev : localhost. Surcharge optionnelle : `VITE_API_URL` au build. */
const API_BASE_URL = (import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.PROD ? PUBLIC_API_BASE_URL : 'http://localhost:3000')) as string;
const TOKEN_KEY = 'pos_token';
const REFRESH_TOKEN_KEY = 'pos_refresh_token';
const USER_KEY = 'pos_user';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(phone: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { phone, password });
  writeToken(data.accessToken);
  writeRefreshToken(data.refreshToken);
  writeSessionUser(data.user);
  return data;
}

export async function getAuthSetupStatus(): Promise<{ needsFirstUser: boolean }> {
  const { data } = await api.get<{ needsFirstUser: boolean }>('/auth/setup-status');
  return data;
}

export async function registerFirstAdmin(payload: {
  phone: string;
  password: string;
  email?: string;
  fullName?: string;
}): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', payload);
  writeToken(data.accessToken);
  writeRefreshToken(data.refreshToken);
  writeSessionUser(data.user);
  return data;
}

export async function getMe(): Promise<SessionUser> {
  const { data } = await api.get<SessionUser>('/auth/me');
  writeSessionUser(data);
  return data;
}

export async function getProducts(departmentId?: number): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products', {
    params: departmentId !== undefined ? { departmentId } : undefined,
  });
  return data;
}

export async function createProduct(payload: {
  name: string;
  companyId?: number;
  departmentId?: number;
  sku?: string;
  barcode?: string;
  isService?: boolean;
  trackStock?: boolean;
  cost?: number;
  stockMin?: number;
  saleUnits: Array<{
    packagingUnitId: number;
    salePrice: number;
    labelOverride?: string;
    isDefault?: boolean;
    volumePrices?: Array<{ minQuantity: number; unitPrice: number }>;
  }>;
}) {
  const { data } = await api.post<Product>('/products', payload);
  return data;
}

export async function updateProduct(
  id: number,
  payload: Partial<{
    name: string;
    companyId: number;
    departmentId: number | null;
    sku: string;
    barcode: string;
    description: string;
    isService: boolean;
    trackStock: boolean;
    cost: number;
    stock: number;
    stockMin: number;
    salePrice: number;
    volumePrices: Array<{ minQuantity: number; unitPrice: number }>;
    packagingUnitId: number;
    labelOverride: string | null;
  }>,
) {
  const { data } = await api.patch<Product>(`/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: number) {
  await api.delete(`/products/${id}`);
}

export async function getCompany(): Promise<CompanyProfile | null> {
  const { data } = await api.get<CompanyProfile | null>('/company');
  return data;
}

export async function patchCompany(payload: Partial<CompanyProfile>) {
  const { data } = await api.patch<CompanyProfile>('/company', payload);
  return data;
}

export async function getCompanies(): Promise<CompanyListItem[]> {
  const { data } = await api.get<CompanyListItem[]>('/companies');
  return data;
}

export type CompanyCreatePayload = {
  name: string;
  legalName?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  currency?: string;
  vatRatePercent?: number;
};

export async function createCompany(payload: CompanyCreatePayload) {
  const { data } = await api.post<CompanyListItem>('/companies', payload);
  return data;
}

export async function getCompanyById(id: number): Promise<CompanyProfile> {
  const { data } = await api.get<CompanyProfile>(`/companies/${id}`);
  return data;
}

export async function updateCompany(id: number, payload: Partial<CompanyCreatePayload>) {
  const { data } = await api.patch<CompanyProfile>(`/companies/${id}`, payload);
  return data;
}

export async function deleteCompany(id: number) {
  await api.delete(`/companies/${id}`);
}

export async function getPrinterSettings(
  departmentId?: number,
): Promise<DepartmentPrinterSettings | null> {
  const { data } = await api.get<DepartmentPrinterSettings | null>('/company/printer', {
    params: departmentId != null ? { departmentId } : undefined,
  });
  return data;
}

export async function patchPrinterSettings(
  payload: Partial<DepartmentPrinterSettings> & { departmentId: number },
) {
  const { data } = await api.patch<DepartmentPrinterSettings>('/company/printer', payload);
  return data;
}

export async function getPackagingUnits(departmentId: number): Promise<PackagingUnit[]> {
  const { data } = await api.get<PackagingUnit[]>('/packaging-units', {
    params: { departmentId },
  });
  return data;
}

export async function createPackagingUnit(payload: {
  departmentId: number;
  code: string;
  label: string;
  sortOrder?: number;
}) {
  const { data } = await api.post<PackagingUnit>('/packaging-units', payload);
  return data;
}

export async function updatePackagingUnit(
  id: number,
  payload: {
    departmentId?: number;
    code?: string;
    label?: string;
    sortOrder?: number;
  },
) {
  const { data } = await api.patch<PackagingUnit>(`/packaging-units/${id}`, payload);
  return data;
}

export async function deletePackagingUnit(id: number) {
  const { data } = await api.delete(`/packaging-units/${id}`);
  return data;
}

export async function getDepartments(companyId?: number): Promise<Department[]> {
  const { data } = await api.get<Department[]>('/departments', {
    params: companyId !== undefined ? { companyId } : undefined,
  });
  return data;
}

export async function createDepartment(payload: {
  name: string;
  description?: string;
  companyId?: number;
}) {
  const { data } = await api.post<Department>('/departments', payload);
  return data;
}

export async function updateDepartment(id: number, payload: { name?: string; description?: string }) {
  const { data } = await api.patch<Department>(`/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: number) {
  const { data } = await api.delete(`/departments/${id}`);
  return data;
}

export async function getUsers(): Promise<SessionUser[]> {
  const { data } = await api.get<SessionUser[]>('/users');
  return data;
}

export async function createUser(payload: {
  phone: string;
  password: string;
  role: string;
  fullName?: string;
  email?: string;
  departmentId?: number;
  companyId?: number;
  isActive?: boolean;
}) {
  const { data } = await api.post('/users', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: Partial<{
    phone: string;
    email: string | null;
    password: string;
    role: string;
    fullName: string;
    departmentId: number | null;
    companyId: number | null;
    isActive: boolean;
  }>,
) {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number) {
  const { data } = await api.delete(`/users/${id}`);
  return data;
}

export async function createSale(payload: CreateSalePayload) {
  const { data } = await api.post('/sales', payload);
  return data;
}

export async function getSalesHistory(): Promise<Sale[]> {
  const { data } = await api.get<Sale[]>('/sales');
  return data;
}

export async function listSales(params: {
  companyId: number;
  skip?: number;
  take?: number;
  /** ISO 8601 (ex. depuis datetime-local converti). */
  createdFrom?: string;
  createdTo?: string;
  departmentId?: number;
}) {
  const { data } = await api.get<{ items: Sale[]; total: number }>('/sales', {
    params: {
      companyId: params.companyId,
      skip: params.skip ?? 0,
      take: params.take ?? 10,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      departmentId: params.departmentId,
    },
  });
  return data;
}

export async function getSaleById(id: number): Promise<Sale> {
  const { data } = await api.get<Sale>(`/sales/${id}`);
  return data;
}

/** Suppression définitive (API réservée au rôle ADMIN). */
export async function deleteSalePermanently(saleId: number, companyId: number): Promise<void> {
  await api.delete(`/sales/${saleId}`, {
    params: { companyId },
  });
}

/** Même mécanisme que `exportInventorySessionsPdf` : PDF généré côté API (pdfkit), blob en réponse. */
export async function exportSalePdf(id: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/sales/${id}/export/pdf`, {
    responseType: 'blob',
  });
  return data;
}

export async function getInventoryAlerts(params?: { threshold?: number; companyId?: number; skip?: number; take?: number }) {
  const threshold = params?.threshold ?? 5;
  const companyId = params?.companyId;
  const skip = params?.skip ?? 0;
  const take = params?.take ?? 10;
  const { data } = await api.get<{ items: Product[]; total: number }>(
    `/inventory/alerts?threshold=${encodeURIComponent(String(threshold))}${companyId ? `&companyId=${companyId}` : ''}&skip=${skip}&take=${take}`,
  );
  return data;
}

export async function getInventoryMovements(params?: {
  skip?: number;
  take?: number;
  companyId?: number;
  /** Tri par date côté serveur : plus récent d'abord (desc) ou plus ancien d'abord (asc). */
  order?: 'asc' | 'desc';
}): Promise<{ items: StockMovementRow[]; total: number }> {
  const { data } = await api.get<{ items: StockMovementRow[]; total: number }>('/inventory/movements', {
    params: {
      skip: params?.skip ?? 0,
      take: params?.take ?? 100,
      companyId: params?.companyId ?? undefined,
      order: params?.order ?? 'desc',
    },
  });
  return data;
}

export async function stockIn(payload: { productId: number; quantity: number; reason?: string }) {
  const { data } = await api.post('/inventory/entries', payload);
  return data;
}

export async function stockAdjust(payload: {
  productId: number;
  quantity: number;
  reason?: string;
}) {
  const { data } = await api.post('/inventory/adjustments', payload);
  return data;
}

export async function createInventorySession(payload: {
  departmentId: number;
  label?: string;
  note?: string;
}): Promise<InventorySessionDetail> {
  const { data } = await api.post<InventorySessionDetail>('/inventory/sessions', payload);
  return data;
}

export async function listInventorySessions(departmentId?: number): Promise<InventorySessionListItem[]> {
  const { data } = await api.get<InventorySessionListItem[]>('/inventory/sessions', {
    params: departmentId != null ? { departmentId } : undefined,
  });
  return data;
}

export async function exportInventorySessionsPdf(params?: { departmentId?: number; take?: number }): Promise<Blob> {
  const { data } = await api.get<Blob>('/inventory/sessions/export/pdf', {
    params: {
      departmentId: params?.departmentId ?? undefined,
      take: params?.take ?? undefined,
    },
    responseType: 'blob',
  });
  return data;
}

export async function getInventorySession(id: number): Promise<InventorySessionDetail> {
  const { data } = await api.get<InventorySessionDetail>(`/inventory/sessions/${id}`);
  return data;
}

export async function patchInventoryLine(
  sessionId: number,
  lineId: number,
  payload: { countedQty?: number | null; note?: string },
) {
  const { data } = await api.patch(`/inventory/sessions/${sessionId}/lines/${lineId}`, payload);
  return data;
}

export async function completeInventorySession(id: number) {
  const { data } = await api.post<InventorySessionDetail>(`/inventory/sessions/${id}/complete`);
  return data;
}

export async function cancelInventorySession(id: number) {
  const { data } = await api.post(`/inventory/sessions/${id}/cancel`);
  return data;
}

export async function listPurchaseOrders(companyId?: number): Promise<PurchaseOrderListItem[]> {
  const { data } = await api.get<PurchaseOrderListItem[]>('/purchasing/orders', {
    params: companyId != null ? { companyId } : undefined,
  });
  return data;
}

export async function createPurchaseOrder(payload: {
  companyId: number;
  departmentId: number;
  supplierName?: string;
  reference?: string;
  note?: string;
  lines: Array<{ productId: number; quantityOrdered: number; unitPriceEst?: number }>;
}) {
  const { data } = await api.post('/purchasing/orders', payload);
  return data;
}

export async function listGoodsReceipts(departmentId?: number): Promise<GoodsReceiptListItem[]> {
  const { data } = await api.get<GoodsReceiptListItem[]>('/purchasing/receipts', {
    params: departmentId != null ? { departmentId } : undefined,
  });
  return data;
}

export async function createGoodsReceipt(payload: {
  departmentId: number;
  purchaseOrderId?: number;
  note?: string;
  lines: Array<{ productId: number; quantity: number; unitCost: number }>;
}) {
  const { data } = await api.post('/purchasing/receipts', payload);
  return data;
}

export async function postGoodsReceipt(id: number) {
  const { data } = await api.post(`/purchasing/receipts/${id}/post`);
  return data;
}

export async function getRecipeByProduct(productId: number): Promise<ProductRecipeDetail | null> {
  const { data } = await api.get<ProductRecipeDetail | null>(`/recipes/by-product/${productId}`);
  return data;
}

export async function upsertRecipe(
  productId: number,
  payload: { components: Array<{ componentProductId: number; quantityPerParentBaseUnit: number }> },
) {
  const { data } = await api.put<ProductRecipeDetail>(`/recipes/${productId}`, payload);
  return data;
}

export async function getRevenueReport() {
  const { data } = await api.get<RevenueReport>('/reports/revenue');
  return data;
}

export async function getFinanceJournal(params?: {
  companyId?: number;
  skip?: number;
  take?: number;
}): Promise<{ items: FinanceEntry[]; total: number }> {
  const { data } = await api.get<{ items: FinanceEntry[]; total: number }>('/finance/journal', {
    params: {
      companyId: params?.companyId ?? undefined,
      skip: params?.skip ?? undefined,
      take: params?.take ?? undefined,
    },
  });
  return data;
}

export async function getFinanceLedger(params: {
  companyId: number;
  dateFrom: string;
  dateTo: string;
  nature?: 'all' | 'purchase' | 'sale' | 'expense';
  skip?: number;
  take?: number;
}): Promise<{ items: FinanceLedgerRow[]; total: number }> {
  const { data } = await api.get<{ items: FinanceLedgerRow[]; total: number }>('/finance/ledger', {
    params: {
      companyId: params.companyId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      nature: params.nature ?? 'all',
      skip: params.skip ?? undefined,
      take: params.take ?? undefined,
    },
  });
  return data;
}

export async function createFinanceEntry(payload: {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  companyId?: number;
  /** YYYY-MM-DD — date comptable (sinon horodatage serveur). */
  entryDate?: string;
}) {
  const { data } = await api.post('/finance/entries', payload);
  return data;
}

export async function getDashboardSummary(params?: { companyId?: number }) {
  const { data } = await api.get<DashboardSummaryReport>('/reports/dashboard-summary', {
    params: { companyId: params?.companyId ?? undefined },
  });
  return data;
}

export async function getDashboardSummaryRange(params: {
  companyId: number;
  dateFrom: string;
  dateTo: string;
  departmentId?: number;
}) {
  const { data } = await api.get<DashboardBalanceSnapshot>('/reports/dashboard-summary-range', {
    params: {
      companyId: params.companyId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      departmentId: params.departmentId,
    },
  });
  return data;
}

export async function getDashboardSalesByProduct(params: {
  companyId: number;
  /** Si dateFrom + dateTo sont fournis, ils priment sur period. */
  period?: 'day' | 'week' | 'month';
  dateFrom?: string;
  dateTo?: string;
  departmentId?: number;
}) {
  const base =
    params.dateFrom && params.dateTo
      ? { companyId: params.companyId, dateFrom: params.dateFrom, dateTo: params.dateTo }
      : {
          companyId: params.companyId,
          period: params.period ?? 'month',
        };
  const { data } = await api.get<DashboardSalesByProductRow[]>('/reports/dashboard-sales-by-product', {
    params: {
      ...base,
      ...(params.departmentId != null && params.departmentId > 0
        ? { departmentId: params.departmentId }
        : {}),
    },
  });
  return data;
}

export async function exportDashboardSalesByProductPdf(params: {
  companyId: number;
  dateFrom: string;
  dateTo: string;
  departmentId?: number;
}): Promise<Blob> {
  const { data } = await api.get<Blob>('/reports/dashboard-sales-by-product/export/pdf', {
    params: {
      companyId: params.companyId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      departmentId: params.departmentId,
    },
    responseType: 'blob',
  });
  return data;
}

export async function exportFinancialSynthesisPdf(params: {
  companyId: number;
  dateFrom: string;
  dateTo: string;
  departmentId?: number;
}): Promise<Blob> {
  const { data } = await api.get<Blob>('/reports/dashboard-synthesis/export/pdf', {
    params: {
      companyId: params.companyId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      departmentId: params.departmentId,
    },
    responseType: 'blob',
  });
  return data;
}

export async function refreshSession() {
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    refreshToken,
  });
  writeToken(data.accessToken);
  writeRefreshToken(data.refreshToken);
  return data.accessToken;
}

export function logout() {
  const refreshToken = readRefreshToken();
  if (refreshToken) {
    void api.post('/auth/logout', { refreshToken }).catch(() => undefined);
  }
  clearToken();
  clearRefreshToken();
  clearSessionUser();
}

export function getToken() {
  return readToken();
}

export function getSessionUser(): SessionUser | null {
  return readSessionUser();
}

export function writeSessionUser(user: SessionUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

function readSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function clearSessionUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function readRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function clearRefreshToken() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
