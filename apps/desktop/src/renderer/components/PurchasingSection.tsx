import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import {
  createGoodsReceipt,
  createPurchaseOrder,
  listGoodsReceipts,
  listPurchaseOrders,
  postGoodsReceipt,
} from '../services/api';
import type { Department, GoodsReceiptListItem, Product, PurchaseOrderListItem } from '../types/api';
import { stockPackagingLabel } from '../utils/packagingDisplay';

function formatApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    if (d && typeof d === 'object') {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join(', ');
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Pas de réponse du serveur (réseau ou API arrêtée).';
    }
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

type LineDraft = { productId: number | ''; qty: string; unitCost: string };

type Props = {
  visible: boolean;
  companyId: number | '';
  departments: Department[];
  products: Product[];
  onStockChanged: () => void;
};

export function PurchasingSection({ visible, companyId, departments, products, onStockChanged }: Props) {
  const [orders, setOrders] = useState<PurchaseOrderListItem[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptListItem[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [poMsg, setPoMsg] = useState('');
  const [grMsg, setGrMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Filtres de monitoring (listes)
  const [listDeptId, setListDeptId] = useState<number | ''>('');
  const [listOrderStatus, setListOrderStatus] = useState<PurchaseOrderListItem['status'] | ''>('');
  const [listReceiptStatus, setListReceiptStatus] = useState<GoodsReceiptListItem['status'] | ''>('');
  const [listOrdersSearch, setListOrdersSearch] = useState('');
  const [listReceiptsSearch, setListReceiptsSearch] = useState('');

  const [receiptFormOpen, setReceiptFormOpen] = useState(true);
  const [poFormOpen, setPoFormOpen] = useState(false);

  const [poDeptId, setPoDeptId] = useState<number | ''>('');
  const [poSupplier, setPoSupplier] = useState('');
  const [poRef, setPoRef] = useState('');
  const [poLines, setPoLines] = useState<LineDraft[]>([{ productId: '', qty: '', unitCost: '' }]);

  const [grDeptId, setGrDeptId] = useState<number | ''>('');
  const [grPoId, setGrPoId] = useState<number | ''>('');
  const [grNote, setGrNote] = useState('');
  const [grLines, setGrLines] = useState<LineDraft[]>([{ productId: '', qty: '', unitCost: '' }]);

  const load = useCallback(async () => {
    if (typeof companyId !== 'number') return;
    setLoadErr('');
    try {
      const [o, r] = await Promise.all([
        listPurchaseOrders(companyId),
        listGoodsReceipts(listDeptId === '' ? undefined : listDeptId),
      ]);
      setOrders(o);
      setReceipts(r);
    } catch (err) {
      setLoadErr(formatApiError(err, 'Chargement impossible.'));
    }
  }, [companyId, listDeptId]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  useEffect(() => {
    if (departments.length && grDeptId === '') {
      setGrDeptId(departments[0].id);
    }
    if (departments.length && poDeptId === '') {
      setPoDeptId(departments[0].id);
    }
  }, [departments, grDeptId, poDeptId]);

  useEffect(() => {
    // Si on a un BC lié au brouillon, assure que ça matche le département sélectionné.
    if (grPoId === '' || grDeptId === '') return;
    const match = orders.find((o) => o.id === grPoId && o.department.id === grDeptId);
    if (!match) setGrPoId('');
  }, [grPoId, grDeptId, orders]);

  function productsForDept(deptId: number | '') {
    if (deptId === '') return [];
    return products.filter((p) => p.department?.id === deptId && p.trackStock && !p.isService);
  }

  const ordersFiltered = useMemo(() => {
    const q = listOrdersSearch.trim().toLowerCase();
    return orders.filter((o) => {
      if (listDeptId !== '' && o.department.id !== listDeptId) return false;
      if (listOrderStatus !== '' && o.status !== listOrderStatus) return false;
      if (!q) return true;
      const ref = (o.reference ?? '').toLowerCase();
      const supplier = (o.supplierName ?? '').toLowerCase();
      return ref.includes(q) || supplier.includes(q);
    });
  }, [orders, listDeptId, listOrderStatus, listOrdersSearch]);

  const receiptsFiltered = useMemo(() => {
    const q = listReceiptsSearch.trim().toLowerCase();
    return receipts.filter((r) => {
      if (listDeptId !== '' && r.department.id !== listDeptId) return false;
      if (listReceiptStatus !== '' && r.status !== listReceiptStatus) return false;
      if (typeof companyId === 'number' && r.department.companyId !== companyId) return false;
      if (!q) return true;
      const ref = (r.purchaseOrder?.reference ?? '').toLowerCase();
      return ref.includes(q);
    });
  }, [receipts, listDeptId, listReceiptStatus, listReceiptsSearch, companyId]);

  const purchaseOrdersForReceipt = useMemo(() => {
    if (grDeptId === '') return [];
    return orders
      .filter((o) => o.department.id === grDeptId && o.status !== 'CANCELLED')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, grDeptId]);

  async function onCreatePO(e: FormEvent) {
    e.preventDefault();
    if (typeof companyId !== 'number') return;
    setPoMsg('');
    if (poDeptId === '') {
      setPoMsg('Choisissez un département.');
      return;
    }
    const lines = poLines
      .map((l) => ({
        productId: typeof l.productId === 'number' ? l.productId : 0,
        quantityOrdered: Number(l.qty.replace(',', '.')),
        unitPriceEst: l.unitCost.trim() ? Number(l.unitCost.replace(',', '.')) : undefined,
      }))
      .filter((l) => l.productId > 0 && Number.isFinite(l.quantityOrdered) && l.quantityOrdered > 0);
    if (lines.length === 0) {
      setPoMsg('Ajoutez au moins une ligne valide avec quantité.');
      return;
    }
    setBusy(true);
    try {
      const createdPo = (await createPurchaseOrder({
        companyId,
        departmentId: poDeptId,
        supplierName: poSupplier.trim() || undefined,
        reference: poRef.trim() || undefined,
        lines,
      })) as any;
      setPoLines([{ productId: '', qty: '', unitCost: '' }]);
      setPoMsg('Bon de commande créé.');
      await load();
      // UX: la réception peut être préparée juste après la commande.
      if (createdPo?.id && createdPo?.department?.id) {
        setReceiptFormOpen(true);
        setGrDeptId(createdPo.department.id);
        setGrPoId(createdPo.id);
        setGrLines([{ productId: '', qty: '', unitCost: '' }]);
        setGrNote('');
      }
    } catch (err) {
      setPoMsg(formatApiError(err, 'Création impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateGR(e: FormEvent) {
    e.preventDefault();
    setGrMsg('');
    if (grDeptId === '') {
      setGrMsg('Choisissez un département.');
      return;
    }
    const lines = grLines
      .map((l) => ({
        productId: typeof l.productId === 'number' ? l.productId : 0,
        quantity: Number(l.qty.replace(',', '.')),
        unitCost: Number(l.unitCost.replace(',', '.')),
      }))
      .filter(
        (l) =>
          l.productId > 0 &&
          Number.isFinite(l.quantity) &&
          l.quantity > 0 &&
          Number.isFinite(l.unitCost) &&
          l.unitCost >= 0,
      );
    if (lines.length === 0) {
      setGrMsg('Ajoutez au moins une ligne (produit, quantité, prix d’achat).');
      return;
    }
    setBusy(true);
    try {
      await createGoodsReceipt({
        departmentId: grDeptId,
        purchaseOrderId: grPoId === '' ? undefined : grPoId,
        note: grNote.trim() || undefined,
        lines,
      });
      setGrLines([{ productId: '', qty: '', unitCost: '' }]);
      setGrPoId('');
      setGrMsg('Réception enregistrée (brouillon). Postez-la ci-dessous pour mettre à jour le stock.');
      await load();
    } catch (err) {
      setGrMsg(formatApiError(err, 'Création impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function onPostReceipt(id: number) {
    if (!confirm('Poster cette réception ? Le stock sera augmenté et le coût moyen pondéré mis à jour.')) return;
    setBusy(true);
    setGrMsg('');
    try {
      await postGoodsReceipt(id);
      setGrMsg('Réception postée — stock et coûts à jour.');
      await load();
      onStockChanged();
    } catch (err) {
      setGrMsg(formatApiError(err, 'Postage impossible.'));
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="catalog-layout purchasing-layout">
      {loadErr ? <p className="error-text">{loadErr}</p> : null}

      <div className="grid two-col purchasing-layout">
        <section className="card purchasing-section">
          <h2 className="purchasing-section-title">Achats reçus (réceptions)</h2>
          
          {grMsg ? <p className={/postée|enregistrée/i.test(grMsg) ? 'info-text' : 'error-text'}>{grMsg}</p> : null}

          <div className="purchasing-form-head" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.75rem' }}>
            <label>
              Département (monitor)
              <select value={listDeptId === '' ? '' : String(listDeptId)} onChange={(e) => setListDeptId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Tous</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.company ? `${d.company.name} — ${d.name}` : d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Statut (monitor)
              <select value={listReceiptStatus} onChange={(e) => setListReceiptStatus(e.target.value ? (e.target.value as GoodsReceiptListItem['status']) : '')}>
                <option value="">Tous</option>
                <option value="DRAFT">Brouillon</option>
                <option value="POSTED">Posté</option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Recherche BC (référence)
              <input value={listReceiptsSearch} onChange={(e) => setListReceiptsSearch(e.target.value)} placeholder="Ex. F-1024" />
            </label>
          </div>

          <div className="card catalog-accordion purchasing-accordion">
            <button
              type="button"
              className="catalog-accordion-trigger"
              id="purchasing-gr-heading"
              aria-expanded={receiptFormOpen}
              aria-controls="purchasing-gr-panel"
              onClick={() => setReceiptFormOpen((o) => !o)}
            >
              <span className="catalog-accordion-title">Nouvelle réception (brouillon)</span>
              <span className={`catalog-accordion-chevron${receiptFormOpen ? ' is-open' : ''}`} aria-hidden />
            </button>
            {receiptFormOpen ? (
              <div
                className="catalog-accordion-panel"
                id="purchasing-gr-panel"
                role="region"
                aria-labelledby="purchasing-gr-heading"
              >
                <form className="purchasing-gr-form" onSubmit={(e) => void onCreateGR(e)}>
                  <div className="form-grid purchasing-form-head">
                    <label>
                      Département *
                      <select
                        value={grDeptId === '' ? '' : String(grDeptId)}
                        onChange={(e) => setGrDeptId(e.target.value ? Number(e.target.value) : '')}
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.company ? `${d.company.name} — ${d.name}` : d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Lier à un BC (optionnel)
                      <select
                        value={grPoId === '' ? '' : String(grPoId)}
                        onChange={(e) => {
                          const next = e.target.value ? Number(e.target.value) : '';
                          setGrPoId(next);
                          if (next !== '') {
                            const o = orders.find((x) => x.id === next);
                            if (o) setGrDeptId(o.department.id);
                          }
                        }}
                      >
                        <option value="">— Aucun</option>
                        {purchaseOrdersForReceipt.map((o) => (
                          <option key={o.id} value={o.id}>
                            #{o.reference ?? o.id} · {o.department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Note (optionnel)
                      <input value={grNote} onChange={(e) => setGrNote(e.target.value)} />
                    </label>
                  </div>
                  <div className="purchasing-lines-block">
                    <p className="dept-hint purchasing-lines-caption">Lignes — prix d’achat par unité de conditionnement</p>
                    {grLines.map((row, idx) => (
                      <div key={idx} className="purchasing-line-grid">
                        <label>
                          Produit
                          <select
                            value={row.productId === '' ? '' : String(row.productId)}
                            onChange={(e) => {
                              const next = [...grLines];
                              next[idx] = {
                                ...next[idx],
                                productId: e.target.value ? Number(e.target.value) : '',
                              };
                              setGrLines(next);
                            }}
                          >
                            <option value="">—</option>
                            {productsForDept(grDeptId).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {stockPackagingLabel(p)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Qté reçue
                          <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex. 4,0001"
                            value={row.qty}
                            onChange={(e) => {
                              const next = [...grLines];
                              next[idx] = { ...next[idx], qty: e.target.value };
                              setGrLines(next);
                            }}
                          />
                        </label>
                        <label>
                          Prix achat / u.
                          <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Ex. 2,50"
                            value={row.unitCost}
                            onChange={(e) => {
                              const next = [...grLines];
                              next[idx] = { ...next[idx], unitCost: e.target.value };
                              setGrLines(next);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm purchasing-line-remove"
                          onClick={() => setGrLines(grLines.filter((_, i) => i !== idx))}
                          title="Retirer"
                          aria-label="Retirer"
                        >
                          -
                        </button>
                      </div>
                    ))}
                    <div className="purchasing-line-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setGrLines([...grLines, { productId: '', qty: '', unitCost: '' }])}
                      >
                        + Ligne
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={busy}>
                        Enregistrer le brouillon
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          <h3 className="purchasing-subheading">Réceptions — liste</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dépt.</th>
                  <th>Statut</th>
                  <th>Lignes</th>
                  <th className="purchasing-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {receiptsFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Aucune réception.</td>
                  </tr>
                ) : (
                  receiptsFiltered.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>{r.department.name}</td>
                      <td>{r.status}</td>
                      <td>{r._count.lines}</td>
                      <td className="purchasing-col-action">
                        {r.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => void onPostReceipt(r.id)}
                          >
                            Poster
                          </button>
                        ) : (
                          <span className="dept-hint">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card purchasing-section">
          <h2 className="purchasing-section-title">Commandes fournisseur (bons)</h2>
      
          {poMsg ? <p className={/créé/i.test(poMsg) ? 'info-text' : 'error-text'}>{poMsg}</p> : null}

          <div className="purchasing-form-head" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '0.75rem' }}>
            <label>
              Département (monitor)
              <select value={listDeptId === '' ? '' : String(listDeptId)} onChange={(e) => setListDeptId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Tous</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.company ? `${d.company.name} — ${d.name}` : d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Statut (monitor)
              <select value={listOrderStatus} onChange={(e) => setListOrderStatus(e.target.value ? (e.target.value as PurchaseOrderListItem['status']) : '')}>
                <option value="">Tous</option>
                <option value="DRAFT">Brouillon</option>
                <option value="ORDERED">Confirmé</option>
                <option value="CLOSED">Clôturé</option>
                <option value="CANCELLED">Annulé</option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Recherche
              <input value={listOrdersSearch} onChange={(e) => setListOrdersSearch(e.target.value)} placeholder="Réf. ou fournisseur" />
            </label>
          </div>

          <div className="card catalog-accordion purchasing-accordion">
            <button
              type="button"
              className="catalog-accordion-trigger"
              id="purchasing-po-heading"
              aria-expanded={poFormOpen}
              aria-controls="purchasing-po-panel"
              onClick={() => setPoFormOpen((o) => !o)}
            >
              <span className="catalog-accordion-title">Nouveau bon de commande</span>
              <span className={`catalog-accordion-chevron${poFormOpen ? ' is-open' : ''}`} aria-hidden />
            </button>
            {poFormOpen ? (
              <div
                className="catalog-accordion-panel"
                id="purchasing-po-panel"
                role="region"
                aria-labelledby="purchasing-po-heading"
              >
                <form className="form-grid purchasing-form-head" onSubmit={(e) => void onCreatePO(e)}>
                  <label>
                    Département *
                    <select
                      value={poDeptId === '' ? '' : String(poDeptId)}
                      onChange={(e) => setPoDeptId(e.target.value ? Number(e.target.value) : '')}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.company ? `${d.company.name} — ${d.name}` : d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fournisseur (optionnel)
                    <input value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} />
                  </label>
                  <label>
                    Référence (optionnel)
                    <input value={poRef} onChange={(e) => setPoRef(e.target.value)} />
                  </label>
                  <div className="purchasing-lines-block" style={{ gridColumn: '1 / -1' }}>
                    <p className="dept-hint purchasing-lines-caption">Lignes</p>
                    {poLines.map((row, idx) => (
                      <div key={idx} className="purchasing-line-grid">
                        <label>
                          Produit
                          <select
                            value={row.productId === '' ? '' : String(row.productId)}
                            onChange={(e) => {
                              const next = [...poLines];
                              next[idx] = {
                                ...next[idx],
                                productId: e.target.value ? Number(e.target.value) : '',
                              };
                              setPoLines(next);
                            }}
                          >
                            <option value="">—</option>
                            {productsForDept(poDeptId).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {stockPackagingLabel(p)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Qté
                          <input
                            type="number"
                            min={0.0001}
                            step="any"
                            value={row.qty}
                            onChange={(e) => {
                              const next = [...poLines];
                              next[idx] = { ...next[idx], qty: e.target.value };
                              setPoLines(next);
                            }}
                          />
                        </label>
                        <label>
                          Prix est.
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.unitCost}
                            onChange={(e) => {
                              const next = [...poLines];
                              next[idx] = { ...next[idx], unitCost: e.target.value };
                              setPoLines(next);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm purchasing-line-remove"
                          onClick={() => setPoLines(poLines.filter((_, i) => i !== idx))}
                          title="Retirer"
                          aria-label="Retirer"
                        >
                          -
                        </button>
                      </div>
                    ))}
                    <div className="purchasing-line-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPoLines([...poLines, { productId: '', qty: '', unitCost: '' }])}
                      >
                        + Ligne
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy || typeof companyId !== 'number'}
                      >
                        Créer le bon
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          <h3 className="purchasing-subheading">Bons de commande — liste</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Réf.</th>
                  <th>Fournisseur</th>
                  <th>Dépt.</th>
                  <th>Statut</th>
                  <th>Lignes</th>
                  <th className="purchasing-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {ordersFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Aucun bon.</td>
                  </tr>
                ) : (
                  ordersFiltered.map((o) => (
                    <tr key={o.id}>
                      <td>{new Date(o.createdAt).toLocaleString()}</td>
                      <td>{o.reference ?? '—'}</td>
                      <td>{o.supplierName ?? '—'}</td>
                      <td>{o.department.name}</td>
                      <td>{o.status}</td>
                      <td>{o._count.lines}</td>
                      <td className="purchasing-col-action">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy || o.status === 'CANCELLED'}
                          onClick={() => {
                            setReceiptFormOpen(true);
                            setGrDeptId(o.department.id);
                            setGrPoId(o.id);
                            setGrLines([{ productId: '', qty: '', unitCost: '' }]);
                            setGrNote('');
                          }}
                        >
                          Créer réception
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
