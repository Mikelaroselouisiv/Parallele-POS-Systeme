// Logique de panier portée de apps/desktop/src/renderer/pages/PosPage.tsx (fonctions pures).
import type { Product, ProductSaleUnit } from '@/types/api';
import { resolveVolumeUnitPrice } from './volumeUnitPrice';

/** Quantité décimale dans l'unité choisie (caisse, bouteille…) ; le stock est dans la même unité. */
export const QTY_DECIMALS = 4;
export const MIN_SALE_QTY = 0.0001;

export type CartLine = {
  productSaleUnitId: number;
  productId: number;
  label: string;
  quantity: number;
  /** Facteur stock (1 = 1 unité vendue = 1 unité de stock) */
  unitsPerPackage: number;
};

export function defaultSaleUnit(p: Product): ProductSaleUnit | undefined {
  const units = p.saleUnits ?? [];
  return units.find((u) => u.isDefault) ?? units[0];
}

export function roundQty(q: number): number {
  return Math.round(q * 10 ** QTY_DECIMALS) / 10 ** QTY_DECIMALS;
}

/** Quantité max vendable dans l'unité choisie (décimal), ou undefined si pas de limite stock (service). */
export function maxQtyInSaleUnit(p: Product, unitsPerPackage: number): number | undefined {
  if (!p.trackStock || p.isService) return undefined;
  const base = Number(p.stock);
  const up = Number(unitsPerPackage);
  if (!Number.isFinite(base) || !Number.isFinite(up) || up <= 0) return 0;
  return roundQty(base / up);
}

export function clampQty(q: number, maxQ: number | undefined): number {
  let x = Math.max(MIN_SALE_QTY, q);
  if (maxQ !== undefined && Number.isFinite(maxQ)) {
    x = Math.min(x, Math.max(MIN_SALE_QTY, maxQ));
  }
  return roundQty(x);
}

export function effectiveUnitPrice(product: Product | undefined, line: CartLine): number {
  if (!product) return 0;
  const su = product.saleUnits?.find((s) => s.id === line.productSaleUnitId);
  if (!su) return 0;
  const tiers = (su.volumePrices ?? []).map((v) => ({
    minQuantity: Number(v.minQuantity),
    unitPrice: Number(v.unitPrice),
  }));
  return resolveVolumeUnitPrice(Number(su.salePrice), tiers, line.quantity);
}

export function addLineToCart(
  cart: CartLine[],
  product: Product,
): { cart: CartLine[]; error?: string } {
  const su = defaultSaleUnit(product);
  if (!su) return { cart, error: 'Produit sans unité de vente' };

  const up = Number(su.unitsPerPackage);
  const maxQ = maxQtyInSaleUnit(product, up);
  if (maxQ !== undefined && maxQ < MIN_SALE_QTY) {
    return { cart, error: 'Stock insuffisant pour ce produit' };
  }

  const existingIndex = cart.findIndex((l) => l.productSaleUnitId === su.id);
  if (existingIndex >= 0) {
    const next = [...cart];
    const merged = roundQty(next[existingIndex].quantity + 1);
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: clampQty(merged, maxQtyInSaleUnit(product, next[existingIndex].unitsPerPackage)),
    };
    return { cart: next };
  }

  const firstQty = maxQ === undefined ? 1 : roundQty(Math.min(1, Math.max(MIN_SALE_QTY, maxQ)));
  const label = su.labelOverride
    ? `${product.name} (${su.labelOverride})`
    : `${product.name} (${su.packagingUnit.label})`;

  return {
    cart: [
      ...cart,
      {
        productSaleUnitId: su.id,
        productId: product.id,
        label,
        quantity: firstQty,
        unitsPerPackage: up,
      },
    ],
  };
}

export function bumpCartLine(
  cart: CartLine[],
  products: Product[],
  productSaleUnitId: number,
  delta: number,
): CartLine[] {
  return cart
    .map((l) => {
      if (l.productSaleUnitId !== productSaleUnitId) return l;
      const p = products.find((x) => x.id === l.productId);
      const maxQ = p ? maxQtyInSaleUnit(p, l.unitsPerPackage) : undefined;
      return { ...l, quantity: clampQty(l.quantity + delta, maxQ) };
    })
    .filter((l) => l.quantity >= MIN_SALE_QTY);
}
