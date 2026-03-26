import { useEffect, useMemo, useState } from 'react';
import {
  createSale,
  getCompany,
  getCompanyById,
  getCompanies,
  getDepartments,
  getPrinterSettings,
  getProducts,
} from '../services/api';
import { enqueueSale, syncSalesQueue } from '../services/offline-queue';
import type {
  CompanyListItem,
  CompanyProfile,
  Department,
  DepartmentPrinterSettings,
  Product,
  ProductSaleUnit,
} from '../types/api';
import { useAuth } from '../context/AuthContext';
import { useAutoClearMessage } from '../hooks/useAutoClearMessage';
import { resolveVolumeUnitPrice } from '../utils/volumeUnitPrice';

/** Quantité décimale dans l’unité choisie (caisse, bouteille…) ; le stock est dans la même unité. */
const QTY_DECIMALS = 4;
const MIN_SALE_QTY = 0.0001;

type CartLine = {
  productSaleUnitId: number;
  productId: number;
  label: string;
  quantity: number;
  /** Facteur stock (1 = 1 unité vendue = 1 unité de stock) */
  unitsPerPackage: number;
};

function defaultSaleUnit(p: Product): ProductSaleUnit | undefined {
  const units = p.saleUnits ?? [];
  return units.find((u) => u.isDefault) ?? units[0];
}

function roundQty(q: number): number {
  return Math.round(q * 10 ** QTY_DECIMALS) / 10 ** QTY_DECIMALS;
}

/** Quantité max vendable dans l’unité choisie (décimal), ou undefined si pas de limite stock (service). */
function maxQtyInSaleUnit(p: Product, unitsPerPackage: number): number | undefined {
  if (!p.trackStock || p.isService) return undefined;
  const base = Number(p.stock);
  const up = Number(unitsPerPackage);
  if (!Number.isFinite(base) || !Number.isFinite(up) || up <= 0) return 0;
  return roundQty(base / up);
}

function clampQty(q: number, maxQ: number | undefined): number {
  let x = Math.max(MIN_SALE_QTY, q);
  if (maxQ !== undefined && Number.isFinite(maxQ)) {
    x = Math.min(x, Math.max(MIN_SALE_QTY, maxQ));
  }
  return roundQty(x);
}

function effectiveUnitPrice(product: Product | undefined, line: CartLine): number {
  if (!product) return 0;
  const su = product.saleUnits?.find((s) => s.id === line.productSaleUnitId);
  if (!su) return 0;
  const tiers = (su.volumePrices ?? []).map((v) => ({
    minQuantity: Number(v.minQuantity),
    unitPrice: Number(v.unitPrice),
  }));
  return resolveVolumeUnitPrice(Number(su.salePrice), tiers, line.quantity);
}

export function PosPage() {
  const { user } = useAuth();
  const cashierLabel = user?.fullName?.trim() || user?.phone || 'Caissier';
  const isCashier = user?.role === 'CASHIER';
  const [products, setProducts] = useState<Product[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [printer, setPrinter] = useState<DepartmentPrinterSettings | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');
  type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'SPLIT';
  type SaleDraft = {
    id: string;
    cart: CartLine[];
    paymentMethod: PaymentMethod;
    name: string;
  };

  const [drafts, setDrafts] = useState<SaleDraft[]>(() => [
    { id: 'd1', cart: [], paymentMethod: 'CASH', name: 'Client' },
  ]);
  const [activeDraftId, setActiveDraftId] = useState<string>('d1');
  const [status, setStatus] = useAutoClearMessage();

  useEffect(() => {
    if (!user) return;

    const deptId = typeof user.departmentId === 'number' ? user.departmentId : undefined;
    const userCompanyId = typeof user.companyId === 'number' ? user.companyId : undefined;

    if (isCashier) {
      void Promise.all([
        getProducts(deptId),
        getCompany(),
        getPrinterSettings(deptId),
      ])
        .then(([prods, co, pr]) => {
          setProducts(prods);
          setCompany(co);
          setPrinter(pr);
        })
        .catch(() => setStatus('Erreur chargement caisse', { persist: true }));
      return;
    }

    void (async () => {
      try {
        const [allProds, companyList] = await Promise.all([getProducts(), getCompanies()]);
        setProducts(allProds);
        setCompanies(companyList);

        const nextCompanyId: number | '' = userCompanyId ?? companyList[0]?.id ?? '';
        setSelectedCompanyId(nextCompanyId);

        const nextCompanyIdNumber = typeof nextCompanyId === 'number' ? nextCompanyId : undefined;
        const nextDepartments = await getDepartments(nextCompanyIdNumber);
        setDepartments(nextDepartments);

        const nextDeptId: number | '' =
          typeof user.departmentId === 'number'
            ? user.departmentId
            : nextDepartments[0]?.id ?? '';
        setSelectedDepartmentId(nextDeptId);

        const nextDeptIdNumber = typeof nextDeptId === 'number' ? nextDeptId : undefined;
        if (nextCompanyIdNumber !== undefined) {
          const co = await getCompanyById(nextCompanyIdNumber);
          setCompany(co);
        }
        if (nextDeptIdNumber !== undefined) {
          const pr = await getPrinterSettings(nextDeptIdNumber);
          setPrinter(pr);
        }
      } catch {
        setStatus('Erreur chargement caisse', { persist: true });
      }
    })();
  }, [user?.id, user?.role, user?.departmentId, user?.companyId]);

  // Pour les managers/admin : recharger les listes de départements si l'entreprise change.
  useEffect(() => {
    if (!user || isCashier) return;
    if (selectedCompanyId === '') return;

    void getDepartments(Number(selectedCompanyId))
      .then((depts) => {
        setDepartments(depts);
        setSelectedDepartmentId((prev) => {
          if (typeof prev === 'number' && depts.some((d) => d.id === prev)) return prev;
          return depts[0]?.id ?? '';
        });
      })
      .catch(() => undefined);
  }, [user, isCashier, selectedCompanyId]);

  // Pour les managers/admin : recharger les réglages d'entreprise et d'imprimante si besoin.
  useEffect(() => {
    if (!user || isCashier) return;
    if (selectedCompanyId === '') {
      setCompany(null);
      return;
    }

    void getCompanyById(Number(selectedCompanyId))
      .then(setCompany)
      .catch(() => undefined);
  }, [user, isCashier, selectedCompanyId]);

  useEffect(() => {
    if (!user || isCashier) return;
    if (selectedDepartmentId === '') {
      setPrinter(null);
      return;
    }

    void getPrinterSettings(Number(selectedDepartmentId))
      .then(setPrinter)
      .catch(() => undefined);
  }, [user, isCashier, selectedDepartmentId]);

  const displayedProducts = useMemo(() => {
    if (isCashier) return products;
    if (selectedCompanyId === '' && selectedDepartmentId === '') return products;

    return products.filter((p) => {
      const companyId = p.companyId ?? p.company?.id;
      const deptId = p.department?.id;
      if (selectedCompanyId !== '' && companyId !== selectedCompanyId) return false;
      if (selectedDepartmentId !== '' && deptId !== selectedDepartmentId) return false;
      return true;
    });
  }, [products, isCashier, selectedCompanyId, selectedDepartmentId]);

  useEffect(() => {
    void syncSalesQueue()
      .then((r) => {
        if (r.synced > 0) setStatus(`Synchronisé : ${r.synced} vente(s) hors ligne`);
      })
      .catch(() => undefined);
  }, []);

  const activeDraft = useMemo(
    () => drafts.find((d) => d.id === activeDraftId) ?? drafts[0],
    [drafts, activeDraftId],
  );
  const activeCart = activeDraft?.cart ?? [];

  const cartTotal = useMemo(
    () =>
      activeCart.reduce((sum, l) => {
        const p = products.find((x) => x.id === l.productId);
        return sum + effectiveUnitPrice(p, l) * l.quantity;
      }, 0),
    [activeCart, products],
  );

  function updateActiveDraft(next: (d: SaleDraft) => SaleDraft) {
    setDrafts((prev) => prev.map((d) => (d.id === activeDraftId ? next(d) : d)));
  }

  function removeActiveDraftFromUI() {
    // On veut que la fiche encaissée disparaisse de l'interface.
    // Si c'est la dernière fiche, on la réinitialise pour continuer à encaisser.
    if (drafts.length <= 1) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === activeDraftId ? { ...d, cart: [], name: 'Client' } : d)),
      );
      return;
    }

    const remaining = drafts.filter((d) => d.id !== activeDraftId);
    if (remaining.length === 0) return;
    setDrafts(remaining);
    setActiveDraftId(remaining[0].id);
  }

  function createDraft() {
    const nextId = `d${Date.now()}`;
    setDrafts((prev) => [...prev, { id: nextId, cart: [], paymentMethod: 'CASH', name: 'Client' }]);
    setActiveDraftId(nextId);
  }

  function setActivePaymentMethod(m: PaymentMethod) {
    updateActiveDraft((d) => ({ ...d, paymentMethod: m }));
  }

  function setActiveDraftName(name: string) {
    updateActiveDraft((d) => ({ ...d, name }));
  }

  function deleteDraft(id: string) {
    setDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter((d) => d.id !== id);
      if (remaining.length === 0) return prev;
      if (activeDraftId === id) setActiveDraftId(remaining[0].id);
      return remaining;
    });
  }

  function formatQty(q: number) {
    return String(parseFloat(roundQty(q).toFixed(QTY_DECIMALS)));
  }

  function addLine(p: Product) {
    const su = defaultSaleUnit(p);
    if (!su) {
      setStatus('Produit sans unité de vente — configurez-le dans Stock.', { persist: true });
      return;
    }
    const up = Number(su.unitsPerPackage);
    const maxQ = maxQtyInSaleUnit(p, up);
    if (maxQ !== undefined && maxQ < MIN_SALE_QTY) {
      setStatus('Stock insuffisant pour ce produit.', { persist: true });
      return;
    }
    const firstQty =
      maxQ === undefined ? 1 : roundQty(Math.min(1, Math.max(MIN_SALE_QTY, maxQ)));
    updateActiveDraft((d) => {
      const prev = d.cart;
      const i = prev.findIndex((l) => l.productSaleUnitId === su.id);
      if (i >= 0) {
        const next = [...prev];
        const merged = roundQty(next[i].quantity + 1);
        next[i] = {
          ...next[i],
          quantity: clampQty(merged, maxQtyInSaleUnit(p, next[i].unitsPerPackage)),
        };
        return { ...d, cart: next };
      }
      const label = su.labelOverride
        ? `${p.name} (${su.labelOverride})`
        : `${p.name} (${su.packagingUnit.label})`;
      return {
        ...d,
        cart: [
          ...prev,
          {
            productSaleUnitId: su.id,
            productId: p.id,
            label,
            quantity: firstQty,
            unitsPerPackage: up,
          },
        ],
      };
    });
  }

  function bumpQty(productSaleUnitId: number, delta: number) {
    updateActiveDraft((d) => ({
      ...d,
      cart: d.cart
        .map((l) => {
          if (l.productSaleUnitId !== productSaleUnitId) return l;
          const p = products.find((x) => x.id === l.productId);
          const maxQ = p ? maxQtyInSaleUnit(p, l.unitsPerPackage) : undefined;
          const q = clampQty(l.quantity + delta, maxQ);
          return { ...l, quantity: q };
        })
        .filter((l) => l.quantity >= MIN_SALE_QTY),
    }));
  }

  function setLineQty(productSaleUnitId: number, raw: string) {
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    if (parsed < MIN_SALE_QTY) {
      updateActiveDraft((d) => ({
        ...d,
        cart: d.cart.filter((l) => l.productSaleUnitId !== productSaleUnitId),
      }));
      return;
    }
    updateActiveDraft((d) => ({
      ...d,
      cart: d.cart
        .map((l) => {
          if (l.productSaleUnitId !== productSaleUnitId) return l;
          const p = products.find((x) => x.id === l.productId);
          const maxQ = p ? maxQtyInSaleUnit(p, l.unitsPerPackage) : undefined;
          const q = clampQty(parsed, maxQ);
          return { ...l, quantity: q };
        })
        .filter((l) => l.quantity >= MIN_SALE_QTY),
    }));
  }

  async function checkout() {
    if (activeCart.length === 0) return;
    const total = cartTotal;
    const clientName = activeDraft.name || null;
    const payload = {
      items: activeCart.map((l) => ({
        productSaleUnitId: l.productSaleUnitId,
        quantity: l.quantity,
      })),
      payments: [{ method: activeDraft.paymentMethod, amount: total }],
      clientName,
    };
    try {
      if (!navigator.onLine) {
        enqueueSale(payload);
        setStatus('Hors ligne : vente mise en file d’attente');
        removeActiveDraftFromUI();
        return;
      }
      const sale = (await createSale(payload)) as { id: number };
      setStatus(`Vente #${sale.id} enregistrée`);
      if (window.desktopApp?.printReceipt) {
        await window.desktopApp.printReceipt({
          companyName: company?.name ?? 'Entreprise',
          companyPhone: company?.phone ?? null,
          address: [company?.address, company?.city].filter(Boolean).join(', ') || '',
          cashier: cashierLabel,
          receiptClientName: activeDraft.name || null,
          items: activeCart.map((x) => {
            const pr = products.find((z) => z.id === x.productId);
            return {
              name: x.label,
              qty: x.quantity,
              price: effectiveUnitPrice(pr, x),
            };
          }),
          total,
          paymentMode: activeDraft.paymentMethod,
          paperWidth: printer?.paperWidth === 80 ? 80 : 58,
          printerName: printer?.deviceName ?? '',
          receiptHeaderText: printer?.receiptHeaderText ?? null,
          receiptFooterText: printer?.receiptFooterText ?? null,
          receiptLogoUrl: printer?.receiptLogoUrl ?? null,
          showLogoOnReceipt: printer?.showLogoOnReceipt ?? true,
          autoCut: printer?.autoCut ?? true,
        });
      }
      removeActiveDraftFromUI();
      const deptId = typeof user?.departmentId === 'number' ? user.departmentId : undefined;
      if (isCashier) {
        setProducts(await getProducts(deptId));
      } else {
        setProducts(await getProducts());
      }
    } catch {
      setStatus('Échec vente (stock ou réseau)', { persist: true });
    }
  }

  return (
    <div className="page-inner pos-page">
      <header className="page-header">
        <h1>Caisse</h1>
      </header>

      {status ? <p className="info-text">{status}</p> : null}

      <div className="pos-grid">
        <section className="card pos-products">
          <div
            className="pos-toolbar"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}
          >
            {!isCashier ? (
              <>
                <label>
                  Entreprise
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    {companies.length ? (
                      companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        Chargement...
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  Département
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) =>
                      setSelectedDepartmentId(
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                  >
                    {departments.length ? (
                      departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        Chargement...
                      </option>
                    )}
                  </select>
                </label>
              </>
            ) : null}
            <label>
              Paiement
              <select
                value={activeDraft.paymentMethod}
                onChange={(e) => setActivePaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="CASH">Espèces</option>
                <option value="CARD">Carte</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="SPLIT">Mixte</option>
              </select>
            </label>
          </div>
          <div className="product-grid">
            {displayedProducts.map((p) => {
              const su = defaultSaleUnit(p);
              const basePrice = su ? Number(su.salePrice) : NaN;
              const up = su ? Number(su.unitsPerPackage) : 0;
              const maxInUnit = su && p.trackStock && !p.isService ? maxQtyInSaleUnit(p, up) : undefined;
              const disabled =
                !su ||
                (p.trackStock &&
                  !p.isService &&
                  maxInUnit !== undefined &&
                  maxInUnit < MIN_SALE_QTY);
              const unitLbl =
                su && (su.labelOverride?.trim() || su.packagingUnit.label) + ` (${su.packagingUnit.code})`;
              const stockHint =
                su && p.trackStock && !p.isService
                  ? `${Number(p.stock).toFixed(3)} ${unitLbl} · max vente ${maxInUnit !== undefined ? maxInUnit.toFixed(3) : '—'}`
                  : su && p.isService
                    ? 'service'
                    : su
                      ? 'sans suivi stock'
                      : '—';
              return (
                <button
                  key={p.id}
                  type="button"
                  className="product-tile"
                  disabled={disabled}
                  onClick={() => addLine(p)}
                >
                  <span className="product-tile-name">{p.name}</span>
                  <span className="product-tile-meta">
                    {su ? `dès ${Number(basePrice).toFixed(2)} · ${stockHint}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card pos-cart">
          <div className="pos-drafts">
            <div className="pos-drafts-head">
              <h2>Panier</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => createDraft()}>
                + Fiche
              </button>
            </div>
            <div className="pos-draft-name-edit">
              <label className="pos-draft-name-label">
                Nom fiche
                <input
                  value={activeDraft.name}
                  onChange={(e) => setActiveDraftName(e.target.value)}
                  placeholder="Ex. Client Dupont"
                />
              </label>
            </div>
            <div className="pos-drafts-list" role="tablist" aria-label="Fiches ouvertes">
              {drafts.map((d, idx) => (
                <div key={d.id} className="pos-draft-item">
                  <button
                    type="button"
                    className={`pos-draft-btn${d.id === activeDraftId ? ' active' : ''}`}
                    onClick={() => setActiveDraftId(d.id)}
                    role="tab"
                    aria-selected={d.id === activeDraftId}
                    title={`Fiche ${idx + 1}`}
                  >
                    {d.name || 'Client'}
                  </button>
                  <button
                    type="button"
                    className="pos-draft-del"
                    disabled={drafts.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDraft(d.id);
                    }}
                    title="Supprimer la fiche"
                    aria-label="Supprimer la fiche"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          <ul className="cart-lines">
            {activeCart.map((l) => {
              const pr = products.find((x) => x.id === l.productId);
              const unitP = effectiveUnitPrice(pr, l);
              const lineTotal = unitP * l.quantity;
              return (
              <li key={l.productSaleUnitId} className="cart-line">
                <div className="cart-line-main">
                  <div className="cart-line-title">{l.label}</div>
                  <div className="cart-line-sub">
                    {unitP.toFixed(2)} × {formatQty(l.quantity)} = {lineTotal.toFixed(2)}
                  </div>
                </div>
                <div className="cart-qty-editor">
                  <div className="cart-qty-steppers">
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title="Retirer 1 unité de vente"
                      onClick={() => bumpQty(l.productSaleUnitId, -1)}
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title="Retirer un demi (0,5 unité)"
                      onClick={() => bumpQty(l.productSaleUnitId, -0.5)}
                    >
                      −½
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title="Ajouter un demi (0,5 unité)"
                      onClick={() => bumpQty(l.productSaleUnitId, 0.5)}
                    >
                      +½
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      title="Ajouter 1 unité de vente"
                      onClick={() => bumpQty(l.productSaleUnitId, 1)}
                    >
                      +1
                    </button>
                  </div>
                  <label className="cart-qty-label">
                    Qté (décimal)
                    <input
                      key={`qty-${l.productSaleUnitId}-${l.quantity}`}
                      className="cart-qty-input"
                      type="number"
                      inputMode="decimal"
                      min={MIN_SALE_QTY}
                      step="any"
                      defaultValue={formatQty(l.quantity)}
                      onBlur={(e) => setLineQty(l.productSaleUnitId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </label>
                </div>
              </li>
            );
            })}
          </ul>
          <div className="cart-total-row">
            <span>Total</span>
            <strong>{cartTotal.toFixed(2)}</strong>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={activeCart.length === 0}
            onClick={() => void checkout()}
          >
            Encaisser
          </button>
        </aside>
      </div>
    </div>
  );
}
