import type { Product } from '../types/api';

export function defaultSaleUnitForProduct(p: Product) {
  return p.saleUnits?.find((s) => s.isDefault) ?? p.saleUnits?.[0];
}

/** Unité de stock = unité de l’unité de vente par défaut (conditionnement configuré par département). */
export function stockPackagingLabel(p: Product): string {
  const su = defaultSaleUnitForProduct(p);
  if (!su?.packagingUnit) return '—';
  const lo = su.labelOverride?.trim();
  const base = lo || su.packagingUnit.label;
  return `${base} (${su.packagingUnit.code})`;
}

export type MovementProductPackaging = {
  saleUnits?: Array<{
    isDefault: boolean;
    labelOverride: string | null;
    packagingUnit: { id: number; code: string; label: string };
  }>;
};

export function stockPackagingLabelFromMovementProduct(
  product: { saleUnits?: MovementProductPackaging['saleUnits'] },
): string {
  const su =
    product.saleUnits?.find((s) => s.isDefault) ?? product.saleUnits?.[0];
  if (!su?.packagingUnit) return '—';
  const lo = su.labelOverride?.trim();
  const base = lo || su.packagingUnit.label;
  return `${base} (${su.packagingUnit.code})`;
}
