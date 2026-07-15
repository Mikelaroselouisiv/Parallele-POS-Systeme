import axios from 'axios';
import { resolveApiBaseUrl } from '../config/resolve-api-base-url';
import {
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  USER_KEY,
  secureDelete,
  secureGet,
  secureSet,
} from './secure-store';
import type {
  CompanyProfile,
  CreateSalePayload,
  DashboardSummaryReport,
  DepartmentPrinterSettings,
  LoginResponse,
  PaginatedResult,
  Product,
  Sale,
  SessionUser,
} from '../types/api';

const api = axios.create({ baseURL: resolveApiBaseUrl() });

// Cache mémoire synchrone — expo-secure-store est async, contrairement à localStorage
// côté desktop, donc l'intercepteur axios (qui doit rester synchrone) lit ce cache,
// rempli au démarrage par initAuthCache() et tenu à jour à chaque écriture.
let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let cachedUser: SessionUser | null = null;

export async function initAuthCache(): Promise<void> {
  const [token, refreshToken, userRaw] = await Promise.all([
    secureGet(TOKEN_KEY),
    secureGet(REFRESH_TOKEN_KEY),
    secureGet(USER_KEY),
  ]);
  cachedToken = token;
  cachedRefreshToken = refreshToken;
  cachedUser = userRaw ? (JSON.parse(userRaw) as SessionUser) : null;
}

api.interceptors.request.use((config) => {
  if (cachedToken) {
    config.headers.Authorization = `Bearer ${cachedToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

/**
 * Une vente restée dans l'outbox peut être rejouée après expiration du jeton
 * d'accès. Rafraîchir la session puis rejouer la requête une seule fois.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as
      | (Record<string, unknown> & {
          _posRetried?: boolean;
          url?: string;
          headers?: Record<string, string>;
        })
      | undefined;
    const url = String(config?.url ?? '');
    const canRefresh =
      error?.response?.status === 401 &&
      config &&
      !config._posRetried &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh') &&
      Boolean(cachedRefreshToken);

    if (!canRefresh) return Promise.reject(error);

    config._posRetried = true;
    refreshPromise ??= refreshSession()
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
    const token = await refreshPromise;
    if (!token) return Promise.reject(error);

    config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${token}` };
    return api.request(config);
  },
);

export async function login(phone: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { phone, password });
  await writeToken(data.accessToken);
  await writeRefreshToken(data.refreshToken);
  await writeSessionUser(data.user);
  return data;
}

export async function getMe(): Promise<SessionUser> {
  const { data } = await api.get<SessionUser>('/auth/me');
  await writeSessionUser(data);
  return data;
}

export async function refreshSession(): Promise<string | null> {
  if (!cachedRefreshToken) return null;
  const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
    refreshToken: cachedRefreshToken,
  });
  await writeToken(data.accessToken);
  await writeRefreshToken(data.refreshToken);
  return data.accessToken;
}

export async function logout(): Promise<void> {
  if (cachedRefreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken: cachedRefreshToken });
    } catch {
      /* ignore — meilleure tentative uniquement */
    }
  }
  await clearToken();
  await clearRefreshToken();
  await clearSessionUser();
}

export function getToken(): string | null {
  return cachedToken;
}

export function getSessionUser(): SessionUser | null {
  return cachedUser;
}

export async function writeSessionUser(user: SessionUser): Promise<void> {
  cachedUser = user;
  await secureSet(USER_KEY, JSON.stringify(user));
}

async function clearSessionUser() {
  cachedUser = null;
  await secureDelete(USER_KEY);
}

async function writeToken(token: string) {
  cachedToken = token;
  await secureSet(TOKEN_KEY, token);
}

async function clearToken() {
  cachedToken = null;
  await secureDelete(TOKEN_KEY);
}

async function writeRefreshToken(token: string) {
  cachedRefreshToken = token;
  await secureSet(REFRESH_TOKEN_KEY, token);
}

async function clearRefreshToken() {
  cachedRefreshToken = null;
  await secureDelete(REFRESH_TOKEN_KEY);
}

// --- Endpoints utilisés en Phase 1 (Caisse, Monitor, Imprimante) ---

export async function getProducts(departmentId?: number): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products', {
    params: departmentId !== undefined ? { departmentId } : undefined,
  });
  return data;
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const { data } = await api.post<Sale>('/sales', payload);
  return data;
}

export async function listSales(params: {
  companyId: number;
  skip?: number;
  take?: number;
}): Promise<PaginatedResult<Sale>> {
  const { data } = await api.get<PaginatedResult<Sale>>('/sales', {
    params: {
      companyId: params.companyId,
      skip: params.skip ?? 0,
      take: params.take ?? 10,
    },
  });
  return data;
}

export async function getInventoryAlerts(params?: {
  threshold?: number;
  companyId?: number;
  skip?: number;
  take?: number;
}): Promise<PaginatedResult<Product>> {
  const { data } = await api.get<PaginatedResult<Product>>('/inventory/alerts', {
    params: {
      threshold: params?.threshold ?? 5,
      companyId: params?.companyId,
      skip: params?.skip ?? 0,
      take: params?.take ?? 10,
    },
  });
  return data;
}

export async function getDashboardSummary(params?: {
  companyId?: number;
}): Promise<DashboardSummaryReport> {
  const { data } = await api.get<DashboardSummaryReport>('/reports/dashboard-summary', {
    params: { companyId: params?.companyId },
  });
  return data;
}

export async function getCompany(): Promise<CompanyProfile | null> {
  const { data } = await api.get<CompanyProfile | null>('/company');
  return data;
}

export async function getPrinterSettings(
  departmentId?: number,
): Promise<DepartmentPrinterSettings | null> {
  const { data } = await api.get<DepartmentPrinterSettings | null>('/company/printer', {
    params: departmentId != null ? { departmentId } : undefined,
  });
  return data;
}
