import { getProducts } from './api';
import * as localDb from './local-db-bridge';
import type { Product } from '../types/api';

export function productsCacheKey(departmentId: number | undefined): string {
  return departmentId === undefined ? 'products_all' : `products_dept_${departmentId}`;
}

/** Charge les produits depuis l’API et met en cache SQLite ; si hors ligne / erreur réseau, lit le cache. */
export async function loadProductsWithCache(departmentId: number | undefined): Promise<Product[]> {
  const key = productsCacheKey(departmentId);
  try {
    const products = await getProducts(departmentId);
    if (localDb.hasLocalDb()) {
      await localDb.cacheSet(key, JSON.stringify(products));
    }
    return products;
  } catch {
    const raw = localDb.hasLocalDb() ? await localDb.cacheGet(key) : null;
    if (raw) {
      return JSON.parse(raw) as Product[];
    }
    throw new Error('Catalogue indisponible (pas de réseau ni cache local)');
  }
}
