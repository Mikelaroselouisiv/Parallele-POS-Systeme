import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import {
  createProduct,
  deleteProduct,
  getCompanies,
  getDepartments,
  getPackagingUnits,
  getProducts,
  getRecipeByProduct,
  stockAdjust,
  stockIn,
  updateProduct,
  upsertRecipe,
} from '../services/api';
import type {
  CompanyListItem,
  Department,
  PackagingUnit,
  Product,
} from '../types/api';
import { useAutoClearMessage } from '../hooks/useAutoClearMessage';
import { useAuth } from '../context/AuthContext';
import { InventoryPhysicalSection } from '../components/InventoryPhysicalSection';
import { PurchasingSection } from '../components/PurchasingSection';
import {
  stockPackagingLabel,
} from '../utils/packagingDisplay';

function formatApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    if (d && typeof d === 'object') {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join(', ');
      const e = (d as { error?: unknown }).error;
      if (typeof e === 'string') return e;
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Pas de réponse du serveur (réseau ou API arrêtée).';
    }
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

type StockTab = 'catalog' | 'operations' | 'inventory' | 'purchases';

function defaultSaleUnit(p: Product) {
  return p.saleUnits?.find((s) => s.isDefault) ?? p.saleUnits?.[0];
}

function defaultUnitPrice(p: Product) {
  const u = defaultSaleUnit(p);
  return u ? Number(u.salePrice) : null;
}

type TierDraft = { minQty: string; unitPrice: string };

export function StockPage() {
  const { can } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [packaging, setPackaging] = useState<PackagingUnit[]>([]);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [packId, setPackId] = useState<number | ''>('');
  const [volumeTiers, setVolumeTiers] = useState<TierDraft[]>([]);
  const [msg, setMsg] = useAutoClearMessage();
  const [tab, setTab] = useState<StockTab>('catalog');
  const [opProductId, setOpProductId] = useState<number | ''>('');
  const [opQty, setOpQty] = useState('');
  const [opReason, setOpReason] = useState('');
  const [opKind, setOpKind] = useState<'in' | 'out'>('in');
  const [opMsg, setOpMsg] = useAutoClearMessage();
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  /** Filtres catalogue (liste à droite) — indépendants du formulaire de création */
  const [catalogFilterCompanyId, setCatalogFilterCompanyId] = useState<number | ''>('');
  const [catalogFilterDeptId, setCatalogFilterDeptId] = useState<number | ''>('');
  const [catalogFilterDepartments, setCatalogFilterDepartments] = useState<Department[]>([]);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const isAdmin = can(['ADMIN']);

  const stockableProducts = useMemo(
    () => products.filter((p) => p.trackStock && !p.isService),
    [products],
  );

  const opSelectedProduct = useMemo(
    () => (opProductId === '' ? null : products.find((x) => x.id === opProductId) ?? null),
    [opProductId, products],
  );

  const catalogFilteredSorted = useMemo(() => {
    let list = products;
    if (catalogFilterCompanyId !== '') {
      const cid = catalogFilterCompanyId;
      list = list.filter((p) => (p.companyId ?? p.company?.id) === cid);
    }
    if (catalogFilterDeptId !== '') {
      const did = catalogFilterDeptId;
      list = list.filter((p) => p.department?.id === did);
    }
    return [...list].sort((a, b) => {
      const ca = (a.company?.name ?? '').localeCompare(b.company?.name ?? '', 'fr', { sensitivity: 'base' });
      if (ca !== 0) return ca;
      const da = (a.department?.name ?? '').localeCompare(b.department?.name ?? '', 'fr', { sensitivity: 'base' });
      if (da !== 0) return da;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }, [products, catalogFilterCompanyId, catalogFilterDeptId]);

  const load = async () => {
    const [p, co] = await Promise.all([getProducts(), getCompanies()]);
    setProducts(p);
    setCompanies(co);
    if (co.length && companyId === '') setCompanyId(co[0].id);
  };

  useEffect(() => {
    if (companyId === '') {
      setDepartments([]);
      setDepartmentId('');
      return;
    }
    void getDepartments(companyId).then((d) => {
      setDepartments(d);
      setDepartmentId((prev) => {
        if (prev === '') return '';
        const ok = d.some((x) => x.id === prev);
        return ok ? prev : '';
      });
    });
  }, [companyId]);

  useEffect(() => {
    if (catalogFilterCompanyId === '') {
      setCatalogFilterDepartments([]);
      setCatalogFilterDeptId('');
      return;
    }
    void getDepartments(catalogFilterCompanyId).then((d) => {
      setCatalogFilterDepartments(d);
      setCatalogFilterDeptId((prev) => {
        if (prev === '') return '';
        return d.some((x) => x.id === prev) ? prev : '';
      });
    });
  }, [catalogFilterCompanyId]);

  useEffect(() => {
    void load().catch(() => setMsg('Erreur chargement stock.', { persist: true }));
  }, []);

  useEffect(() => {
    // Sécurité UI: évite l'accès au formulaire d'opérations si le rôle n'est pas ADMIN.
    if (tab === 'operations' && !isAdmin) setTab('catalog');
  }, [tab, isAdmin]);

  useEffect(() => {
    if (departmentId === '') {
      setPackaging([]);
      setPackId('');
      return;
    }
    void getPackagingUnits(departmentId)
      .then((pk) => {
        setPackaging(pk);
        setPackId((prev) => {
          if (prev !== '' && pk.some((u) => u.id === prev)) return prev;
          return pk[0]?.id ?? '';
        });
      })
      .catch(() => {
        setPackaging([]);
        setPackId('');
      });
  }, [departmentId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    const cid = typeof companyId === 'number' ? companyId : companies[0]?.id;
    if (!cid) {
      setMsg('Créez d’abord une entreprise (Configuration → Entreprise).', { persist: true });
      return;
    }
    if (departmentId === '') {
      setMsg('Choisissez un département (les conditionnements sont définis par département).', {
        persist: true,
      });
      return;
    }
    const pid = typeof packId === 'number' ? packId : packaging[0]?.id;
    if (!pid) {
      setMsg('Créez d’abord un conditionnement de vente (Configuration → Conditionnement).', {
        persist: true,
      });
      return;
    }
    const sp = Number(price);
    if (!name.trim() || !Number.isFinite(sp) || sp < 0) return;
    const parsedTiers = volumeTiers
      .map((t) => ({
        minQuantity: Number(t.minQty.replace(',', '.')),
        unitPrice: Number(t.unitPrice.replace(',', '.')),
      }))
      .filter(
        (t) =>
          Number.isFinite(t.minQuantity) &&
          t.minQuantity > 0 &&
          Number.isFinite(t.unitPrice) &&
          t.unitPrice >= 0,
      );
    const seen = new Set<number>();
    for (const t of parsedTiers) {
      if (seen.has(t.minQuantity)) {
        setMsg('Les paliers ne peuvent pas avoir deux fois la même quantité minimale.', { persist: true });
        return;
      }
      seen.add(t.minQuantity);
    }
    try {
      await createProduct({
        name: name.trim(),
        companyId: cid,
        departmentId,
        trackStock: true,
        isService: false,
        saleUnits: [
          {
            packagingUnitId: pid,
            salePrice: sp,
            isDefault: true,
            volumePrices: parsedTiers.length ? parsedTiers : undefined,
          },
        ],
      });
      setName('');
      setPrice('');
      setVolumeTiers([]);
      setMsg('Produit créé (stock initial à 0 — ajustez le stock après réception).');
      await load();
    } catch (err) {
      setMsg(formatApiError(err, 'Échec création produit.'), { persist: true });
    }
  }

  async function onDelete(p: Product) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    setMsg('');
    try {
      await deleteProduct(p.id);
      setMsg('Produit supprimé.');
      await load();
    } catch {
      setMsg('Suppression impossible (produit déjà vendu ou erreur réseau).', { persist: true });
    }
  }

  async function onStockOperation(e: FormEvent) {
    e.preventDefault();
    setOpMsg('');
    if (opProductId === '') {
      setOpMsg('Choisissez un produit.', { persist: true });
      return;
    }
    const qty = Number(opQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setOpMsg('Quantité invalide.', { persist: true });
      return;
    }
    const reason = opReason.trim() || undefined;
    try {
      if (opKind === 'in') {
        await stockIn({
          productId: Number(opProductId),
          quantity: qty,
          reason: reason ?? 'Réception / entrée stock',
        });
      } else {
        const prod = products.find((x) => x.id === opProductId);
        if (!prod) return;
        if (Number(prod.stock) < qty) {
          setOpMsg(
            `Stock insuffisant (disponible : ${Number(prod.stock).toFixed(3)} ${stockPackagingLabel(prod)}).`,
            { persist: true },
          );
          return;
        }
        await stockAdjust({
          productId: Number(opProductId),
          quantity: -qty,
          reason: reason ?? 'Sortie manuelle (casse, invendable, etc.)',
        });
      }
      setOpQty('');
      setOpReason('');
      setOpMsg(opKind === 'in' ? 'Entrée enregistrée.' : 'Sortie enregistrée.');
      await load();
    } catch (err) {
      setOpMsg(formatApiError(err, 'Opération impossible.'), { persist: true });
    }
  }

  return (
    <div className="page-inner">
      <header className="page-header">
        <h1>Stock & produits</h1>

      </header>

      <div className="config-tabs" role="tablist" aria-label="Sections stock">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'catalog'}
          className={`tab ${tab === 'catalog' ? 'active' : ''}`}
          onClick={() => setTab('catalog')}
        >
          Catalogue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'operations'}
          className={`tab ${tab === 'operations' ? 'active' : ''}`}
          disabled={!isAdmin}
          aria-disabled={!isAdmin}
          onClick={() => {
            if (!isAdmin) return;
            setTab('operations');
          }}
        >
          Entrées & sorties
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inventory'}
          className={`tab ${tab === 'inventory' ? 'active' : ''}`}
          onClick={() => setTab('inventory')}
        >
          Inventaire physique
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'purchases'}
          className={`tab ${tab === 'purchases' ? 'active' : ''}`}
          onClick={() => setTab('purchases')}
        >
          Achats & réceptions
        </button>
      </div>

      {tab === 'catalog' ? (
        <>
      <section className="catalog-layout">
        <div className="card catalog-accordion">
          <button
            type="button"
            className="catalog-accordion-trigger"
            id="catalog-add-product-heading"
            aria-expanded={addProductOpen}
            aria-controls="catalog-add-product-panel"
            onClick={() => setAddProductOpen((o) => !o)}
          >
            <span className="catalog-accordion-title">Ajouter un produit</span>
            <span className={`catalog-accordion-chevron${addProductOpen ? ' is-open' : ''}`} aria-hidden />
          </button>
          {addProductOpen ? (
            <div
              className="catalog-accordion-panel"
              id="catalog-add-product-panel"
              role="region"
              aria-labelledby="catalog-add-product-heading"
            >
              <form className="form-grid catalog-add-form" onSubmit={(e) => void onCreate(e)}>
                <label>
                  Entreprise
                  <select
                    value={companyId === '' ? '' : String(companyId)}
                    onChange={(e) => {
                      setCompanyId(e.target.value ? Number(e.target.value) : '');
                      setDepartmentId('');
                    }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Département
                  <select
                    value={departmentId === '' ? '' : String(departmentId)}
                    onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">— Aucun</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nom
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Conditionnement (unité de stock = unité à la caisse)
                  <select
                    value={packId === '' ? '' : String(packId)}
                    onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : '')}
                  >
                    {packaging.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label} ({u.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Prix unitaire de base (sous le 1er palier)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </label>
                <div className="volume-tiers-block catalog-volume-tiers">
                  <p className="dept-hint" style={{ margin: '0 0 0.5rem' }}>
                    Paliers (optionnel) : à partir de la quantité indiquée sur une ligne de vente, le prix unitaire
                    devient le prix « rabais ».
                  </p>
                  {volumeTiers.map((row, idx) => (
                    <div key={idx} className="volume-tier-row">
                      <label>
                        À partir de (qté)
                        <input
                          type="number"
                          min={0.0001}
                          step="any"
                          value={row.minQty}
                          onChange={(e) => {
                            const next = [...volumeTiers];
                            next[idx] = { ...next[idx], minQty: e.target.value };
                            setVolumeTiers(next);
                          }}
                        />
                      </label>
                      <label>
                        Prix unitaire
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.unitPrice}
                          onChange={(e) => {
                            const next = [...volumeTiers];
                            next[idx] = { ...next[idx], unitPrice: e.target.value };
                            setVolumeTiers(next);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setVolumeTiers(volumeTiers.filter((_, i) => i !== idx))}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setVolumeTiers([...volumeTiers, { minQty: '', unitPrice: '' }])}
                  >
                    + Palier
                  </button>
                </div>
                <div className="catalog-add-submit">
                  <button type="submit" className="btn btn-primary">
                    Créer
                  </button>
                </div>
              </form>
              {msg ? <p className="info-text catalog-add-msg">{msg}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="card catalog-list-card">
          <h2>
            Catalogue ({catalogFilteredSorted.length}
            {catalogFilteredSorted.length !== products.length ? ` / ${products.length}` : ''})
          </h2>
          <p className="page-lead" style={{ marginTop: 0 }}>
           
          </p>
          <div className="form-grid" style={{ marginBottom: '1rem', maxWidth: '36rem' }}>
            <label>
              Filtrer par entreprise
              <select
                value={catalogFilterCompanyId === '' ? '' : String(catalogFilterCompanyId)}
                onChange={(e) => {
                  const v = e.target.value;
                  setCatalogFilterCompanyId(v ? Number(v) : '');
                  setCatalogFilterDeptId('');
                }}
              >
                <option value="">Toutes les entreprises</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtrer par département
              <select
                value={catalogFilterDeptId === '' ? '' : String(catalogFilterDeptId)}
                onChange={(e) => setCatalogFilterDeptId(e.target.value ? Number(e.target.value) : '')}
                disabled={catalogFilterCompanyId === ''}
              >
                <option value="">Tous les départements</option>
                {catalogFilterDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Département</th>
                  <th>Conditionnement</th>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th>Prix défaut</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      Aucun produit. Dépliez « Ajouter un produit » ci-dessus ou vérifiez la connexion au serveur.
                    </td>
                  </tr>
                ) : catalogFilteredSorted.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Aucun produit ne correspond aux filtres choisis.</td>
                  </tr>
                ) : (
                  catalogFilteredSorted.map((p) => {
                    const dp = defaultUnitPrice(p);
                    return (
                      <tr key={p.id}>
                        <td>{p.company?.name ?? (p.companyId != null ? `#${p.companyId}` : '—')}</td>
                        <td>{p.department?.name ?? '—'}</td>
                        <td>
                          <small>{stockPackagingLabel(p)}</small>
                        </td>
                        <td>
                          <strong>{p.name}</strong>
                          {p.isService ? <small> (service)</small> : null}
                        </td>
                        <td>{p.sku ?? '—'}</td>
                        <td>{dp != null ? dp.toFixed(2) : '—'}</td>
                        <td>{Number(p.stock).toFixed(3)}</td>
                        <td className="table-actions catalog-table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditProduct(p)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void onDelete(p)}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
        </>
      ) : null}

      {tab === 'inventory' ? (
        <InventoryPhysicalSection
          visible={tab === 'inventory'}
          departments={departments}
          onStockChanged={() => void load()}
        />
      ) : null}

      {tab === 'purchases' ? (
        <PurchasingSection
          visible={tab === 'purchases'}
          companyId={companyId}
          departments={departments}
          products={products}
          onStockChanged={() => void load()}
        />
      ) : null}

      {tab === 'operations' && isAdmin ? (
        <section className="card">
          <h2>Réapprovisionnement & retraits manuels</h2>
          
          {opMsg ? (
            <p className={/enregistrée/i.test(opMsg) ? 'info-text' : 'error-text'}>{opMsg}</p>
          ) : null}
          <form className="form-grid" style={{ maxWidth: '32rem' }} onSubmit={(e) => void onStockOperation(e)}>
            <label>
              Type d’opération
              <select value={opKind} onChange={(e) => setOpKind(e.target.value === 'out' ? 'out' : 'in')}>
                <option value="in">Entrée (augmenter le stock)</option>
                <option value="out">Sortie (diminuer le stock)</option>
              </select>
            </label>
            <label>
              Produit (stock suivi)
              <select
                value={opProductId === '' ? '' : String(opProductId)}
                onChange={(e) => setOpProductId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">— Choisir</option>
                {stockableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {stockPackagingLabel(p)} — stock {Number(p.stock).toFixed(3)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantité
              {opSelectedProduct ? (
                <span className="dept-hint" style={{ display: 'block', fontWeight: 400, marginBottom: '0.25rem' }}>
                  Unité : {stockPackagingLabel(opSelectedProduct)}
                </span>
              ) : null}
              <input
                type="number"
                min={0.0001}
                step="any"
                value={opQty}
                onChange={(e) => setOpQty(e.target.value)}
                required
              />
            </label>
            <label>
              Motif (optionnel)
              <input
                value={opReason}
                onChange={(e) => setOpReason(e.target.value)}
                placeholder={
                  opKind === 'in' ? 'Ex. Réception facture F-1024' : 'Ex. Casse, invendable, inventaire'
                }
              />
            </label>
            <button type="submit" className="btn btn-primary">
              {opKind === 'in' ? 'Enregistrer l’entrée' : 'Enregistrer la sortie'}
            </button>
          </form>
          {stockableProducts.length === 0 ? (
            <p className="info-text" style={{ marginTop: '1rem' }}>
              Aucun produit avec stock suivi. Cochez « Suivre le stock » sur un produit ou créez un article physique.
            </p>
          ) : null}
        </section>
      ) : null}

      {editProduct ? (
        <EditProductModal
          key={editProduct.id}
          product={editProduct}
          products={products}
          companies={companies}
          onClose={() => setEditProduct(null)}
          onSaved={async () => {
            setEditProduct(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function EditProductModal({
  product,
  products,
  companies,
  onClose,
  onSaved,
}: {
  product: Product;
  products: Product[];
  companies: CompanyListItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialCompanyId = product.company?.id ?? product.companyId ?? companies[0]?.id ?? 0;
  const [companyId, setCompanyId] = useState<number>(initialCompanyId);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku ?? '');
  const [barcode, setBarcode] = useState(product.barcode ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [cost, setCost] = useState(String(product.cost ?? 0));
  const [stock, setStock] = useState(String(product.stock ?? 0));
  const [stockMin, setStockMin] = useState(String(product.stockMin ?? 0));
  const [deptId, setDeptId] = useState<string>(product.department ? String(product.department.id) : '');
  const [isService, setIsService] = useState(product.isService);
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const su0 = defaultSaleUnit(product);
  const [salePrice, setSalePrice] = useState(String(su0 ? su0.salePrice : ''));
  const [priceTiers, setPriceTiers] = useState<TierDraft[]>(
    () =>
      su0?.volumePrices?.map((v) => ({
        minQty: String(v.minQuantity),
        unitPrice: String(v.unitPrice),
      })) ?? [],
  );
  const [err, setErr] = useAutoClearMessage();
  const [saving, setSaving] = useState(false);
  const [recipeLines, setRecipeLines] = useState<Array<{ componentProductId: number | ''; qty: string }>>([
    { componentProductId: '', qty: '' },
  ]);
  const [recipeMsg, setRecipeMsg] = useState('');
  const [packagingList, setPackagingList] = useState<PackagingUnit[]>([]);
  const [packagingUnitId, setPackagingUnitId] = useState<number | ''>(su0?.packagingUnitId ?? '');
  const [saleLabelOverride, setSaleLabelOverride] = useState(su0?.labelOverride ?? '');

  const mpChoices = useMemo(
    () =>
      products.filter(
        (p) =>
          p.id !== product.id &&
          (p.companyId ?? companyId) === companyId &&
          p.trackStock &&
          !p.isService,
      ),
    [products, product.id, companyId],
  );

  useEffect(() => {
    if (!isService) return;
    setRecipeMsg('');
    void getRecipeByProduct(product.id)
      .then((r) => {
        if (r?.components?.length) {
          setRecipeLines(
            r.components.map((c) => ({
              componentProductId: c.componentProductId,
              qty: String(c.quantityPerParentBaseUnit),
            })),
          );
        } else {
          setRecipeLines([{ componentProductId: '', qty: '' }]);
        }
      })
      .catch(() => setRecipeLines([{ componentProductId: '', qty: '' }]));
  }, [product.id, isService]);

  useEffect(() => {
    if (!companyId) return;
    void getDepartments(companyId).then((d) => {
      setDepartments(d);
      setDeptId((prev) => {
        if (prev === '') return '';
        return d.some((x) => x.id === Number(prev)) ? prev : '';
      });
    });
  }, [companyId]);

  useEffect(() => {
    if (deptId === '') {
      setPackagingList([]);
      return;
    }
    void getPackagingUnits(Number(deptId)).then((list) => {
      setPackagingList(list);
      setPackagingUnitId((prev) => {
        if (typeof prev === 'number' && list.some((x) => x.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    });
  }, [deptId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Le nom est obligatoire.');
      return;
    }
    if (!companyId) {
      setErr('Choisissez une entreprise.');
      return;
    }
    const parsedTiers = priceTiers
      .map((t) => ({
        minQuantity: Number(t.minQty.replace(',', '.')),
        unitPrice: Number(t.unitPrice.replace(',', '.')),
      }))
      .filter(
        (t) =>
          Number.isFinite(t.minQuantity) &&
          t.minQuantity > 0 &&
          Number.isFinite(t.unitPrice) &&
          t.unitPrice >= 0,
      );
    const seen = new Set<number>();
    for (const t of parsedTiers) {
      if (seen.has(t.minQuantity)) {
        setErr('Paliers : quantité minimale en double.');
        return;
      }
      seen.add(t.minQuantity);
    }
    const sp = Number(salePrice);
    if (!Number.isFinite(sp) || sp < 0) {
      setErr('Prix unitaire de base invalide.');
      return;
    }
    if (deptId !== '') {
      if (typeof packagingUnitId !== 'number') {
        setErr('Choisissez un conditionnement pour ce département (Configuration → Conditionnement).');
        return;
      }
    }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: name.trim(),
        companyId,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        description: description.trim() || undefined,
        cost: Number(cost),
        stock: Number(stock),
        stockMin: Number(stockMin),
        departmentId: deptId === '' ? null : Number(deptId),
        isService,
        trackStock,
        salePrice: sp,
        volumePrices: parsedTiers,
        ...(deptId !== ''
          ? {
              packagingUnitId: packagingUnitId as number,
              labelOverride: saleLabelOverride.trim() || null,
            }
          : {}),
      });
      await onSaved();
    } catch (err) {
      setErr(formatApiError(err, 'Enregistrement impossible.'), { persist: true });
    } finally {
      setSaving(false);
    }
  }

  async function saveRecipe() {
    setRecipeMsg('');
    const components = recipeLines
      .map((l) => ({
        componentProductId: typeof l.componentProductId === 'number' ? l.componentProductId : 0,
        quantityPerParentBaseUnit: Number(l.qty.replace(',', '.')),
      }))
      .filter(
        (l) =>
          l.componentProductId > 0 &&
          Number.isFinite(l.quantityPerParentBaseUnit) &&
          l.quantityPerParentBaseUnit > 0,
      );
    try {
      await upsertRecipe(product.id, { components });
      setRecipeMsg('Recette enregistrée.');
    } catch (err) {
      setRecipeMsg(formatApiError(err, 'Recette impossible.'));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier le produit</h2>
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          <label>
            Entreprise *
            <select
              value={companyId || ''}
              onChange={(e) => setCompanyId(Number(e.target.value))}
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nom *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            SKU
            <input value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label>
            Code-barres
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </label>
          <label>
            Description
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Département
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <p className="dept-hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
            <strong>Conditionnement</strong> : défini par département dans Configuration → Conditionnement. C’est l’unité
            de <strong>stock</strong> et de vente à la caisse.
          </p>
          <label>
            Conditionnement (unité de stock) *
            <select
              value={packagingUnitId === '' ? '' : String(packagingUnitId)}
              onChange={(e) => setPackagingUnitId(e.target.value ? Number(e.target.value) : '')}
              required={deptId !== ''}
              disabled={deptId === '' || packagingList.length === 0}
            >
              <option value="">{deptId === '' ? '— Choisir un département —' : '— Choisir —'}</option>
              {packagingList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} ({u.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Libellé à la caisse (optionnel)
            <input
              value={saleLabelOverride}
              onChange={(e) => setSaleLabelOverride(e.target.value)}
              placeholder="Ex. Bouteille 1L"
              disabled={deptId === ''}
            />
          </label>
          {deptId !== '' && packagingList.length === 0 ? (
            <p className="error-text" style={{ gridColumn: '1 / -1', margin: 0 }}>
              Aucun conditionnement pour ce département. Créez-en dans Configuration → Conditionnement.
            </p>
          ) : null}
          <label>
            Coût
            <input type="number" min={0} step={0.01} value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label>
            Prix unitaire de base (sous le 1er palier)
            <input
              type="number"
              min={0}
              step={0.01}
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </label>
          <div className="volume-tiers-block">
            <p className="dept-hint" style={{ margin: '0 0 0.5rem' }}>
              Paliers : à partir de la quantité sur une ligne de vente, prix unitaire = prix rabais.
            </p>
            {priceTiers.map((row, idx) => (
              <div key={idx} className="volume-tier-row">
                <label>
                  À partir de (qté)
                  <input
                    type="number"
                    min={0.0001}
                    step="any"
                    value={row.minQty}
                    onChange={(e) => {
                      const next = [...priceTiers];
                      next[idx] = { ...next[idx], minQty: e.target.value };
                      setPriceTiers(next);
                    }}
                  />
                </label>
                <label>
                  Prix unitaire rabais
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.unitPrice}
                    onChange={(e) => {
                      const next = [...priceTiers];
                      next[idx] = { ...next[idx], unitPrice: e.target.value };
                      setPriceTiers(next);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPriceTiers(priceTiers.filter((_, i) => i !== idx))}
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPriceTiers([...priceTiers, { minQty: '', unitPrice: '' }])}
            >
              + Palier
            </button>
          </div>
          <label>
            Stock (quantités dans l’unité de conditionnement ci-dessus)
            <input type="number" min={0} step={0.001} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label>
            Stock minimum
            <input
              type="number"
              min={0}
              step={0.001}
              value={stockMin}
              onChange={(e) => setStockMin(e.target.value)}
            />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={isService} onChange={(e) => setIsService(e.target.checked)} />
            Service (sans stock)
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
            Suivre le stock
          </label>
          {isService ? (
            <div className="volume-tiers-block" style={{ gridColumn: '1 / -1' }}>
              <p className="dept-hint" style={{ margin: '0 0 0.5rem' }}>
                <strong>Recette (matières premières)</strong> : quantités consommées par <strong>1 unité de base</strong>{' '}
                du service (même unité que le stock article physique). À la vente, le POS déduit ces stocks.
              </p>
              {recipeLines.map((row, idx) => (
                <div key={idx} className="volume-tier-row">
                  <label>
                    Matière / composant
                    <select
                      value={row.componentProductId === '' ? '' : String(row.componentProductId)}
                      onChange={(e) => {
                        const next = [...recipeLines];
                        next[idx] = {
                          ...next[idx],
                          componentProductId: e.target.value ? Number(e.target.value) : '',
                        };
                        setRecipeLines(next);
                      }}
                    >
                      <option value="">—</option>
                      {mpChoices.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Qté / unité parent
                    <input
                      type="number"
                      min={0.0001}
                      step="any"
                      value={row.qty}
                      onChange={(e) => {
                        const next = [...recipeLines];
                        next[idx] = { ...next[idx], qty: e.target.value };
                        setRecipeLines(next);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRecipeLines(recipeLines.filter((_, i) => i !== idx))}
                  >
                    Retirer
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setRecipeLines([...recipeLines, { componentProductId: '', qty: '' }])
                }
              >
                + Composant
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRecipe()}>
                Enregistrer la recette
              </button>
              {recipeMsg ? (
                <p className={recipeMsg.includes('enregistrée') ? 'info-text' : 'error-text'}>{recipeMsg}</p>
              ) : null}
            </div>
          ) : null}
          {err ? <p className="error-text">{err}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
