import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createFinanceEntry,
  getCompanies,
  getCompanyById,
  exportDashboardSalesByProductPdf,
  getDashboardSummary,
  getDashboardSummaryRange,
  getDashboardSalesByProduct,
  getDepartments,
  getFinanceLedger,
  getInventoryAlerts,
  getInventoryMovements,
  getPrinterSettings,
  deleteSalePermanently,
  getSaleById,
  listSales,
} from '../services/api';
import type {
  CompanyListItem,
  CompanyProfile,
  DashboardBalanceSnapshot,
  DashboardSalesByProductRow,
  DashboardSummaryReport,
  Department,
  DepartmentPrinterSettings,
  FinanceLedgerRow,
  Product,
  Sale,
  StockMovementRow,
} from '../types/api';
import { useAutoClearMessage } from '../hooks/useAutoClearMessage';
import { useAuth } from '../context/AuthContext';
import { DashboardSyntheseTab } from '../components/DashboardSyntheseTab';
import { SaleDetailModal } from '../components/SaleDetailModal';
import { stockPackagingLabelFromMovementProduct } from '../utils/packagingDisplay';

function movementTypeLabel(t: StockMovementRow['type']): string {
  switch (t) {
    case 'IN':
      return 'Entrée';
    case 'OUT':
      return 'Sortie';
    case 'ADJUSTMENT':
      return 'Ajustement';
    default:
      return t;
  }
}

function movementReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '—';
  if (reason === 'Sale') return 'Vente';
  return reason;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultMonthStartYmd(): string {
  const d = new Date();
  d.setDate(1);
  return formatYmd(d);
}

function ymdStartIso(ymd: string): string | undefined {
  if (!ymd.trim()) return undefined;
  const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function ymdEndIso(ymd: string): string | undefined {
  if (!ymd.trim()) return undefined;
  const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function DashboardPage() {
  type TabId = 'synthese' | 'ventes' | 'achats' | 'stock';
  type PeriodId = 'day' | 'week' | 'month';

  const { can, user: sessionUser } = useAuth();
  const isAdmin = can(['ADMIN']);

  const [tab, setTab] = useState<TabId>('ventes');
  const [period, setPeriod] = useState<PeriodId>('month');

  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');

  const [dashboard, setDashboard] = useState<DashboardSummaryReport | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseEntryDate, setExpenseEntryDate] = useState(() => formatYmd(new Date()));

  const [achatsTotalsDateFrom, setAchatsTotalsDateFrom] = useState(defaultMonthStartYmd);
  const [achatsTotalsDateTo, setAchatsTotalsDateTo] = useState(() => formatYmd(new Date()));
  const [achatsTotalsSnapshot, setAchatsTotalsSnapshot] = useState<DashboardBalanceSnapshot | null>(null);
  const [achatsTotalsLoading, setAchatsTotalsLoading] = useState(false);

  const [ledgerDateFrom, setLedgerDateFrom] = useState(defaultMonthStartYmd);
  const [ledgerDateTo, setLedgerDateTo] = useState(() => formatYmd(new Date()));
  const [ledgerNature, setLedgerNature] = useState<'all' | 'purchase' | 'sale' | 'expense'>('all');
  const [ledgerItems, setLedgerItems] = useState<FinanceLedgerRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerSkip, setLedgerSkip] = useState(0);
  const ledgerTake = 10;
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [alerts, setAlerts] = useState<Product[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertsSkip, setAlertsSkip] = useState(0);
  const alertsTake = 10;
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(true);

  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movementsSkip, setMovementsSkip] = useState(0);
  /** Taille d’une « page » (chargement initial + pas du « Charger plus »). */
  const [movementsPageSize, setMovementsPageSize] = useState<5 | 10>(5);
  /** Tri serveur par date de mouvement. */
  const [movementDateOrder, setMovementDateOrder] = useState<'asc' | 'desc'>('desc');
  const [stockQuery, setStockQuery] = useState('');

  const [sales, setSales] = useState<Sale[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesSkip, setSalesSkip] = useState(0);
  const salesTake = 5;
  const [salesLoading, setSalesLoading] = useState(false);
  const [saleModal, setSaleModal] = useState<Sale | null>(null);
  const [saleReceiptCompany, setSaleReceiptCompany] = useState<CompanyProfile | null>(null);
  const [saleReceiptPrinter, setSaleReceiptPrinter] = useState<DepartmentPrinterSettings | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);
  const [saleDeletingId, setSaleDeletingId] = useState<number | null>(null);

  const [salesByProductRows, setSalesByProductRows] = useState<DashboardSalesByProductRow[]>([]);
  const [salesByProductLoading, setSalesByProductLoading] = useState(false);
  const [ventesDateFrom, setVentesDateFrom] = useState(defaultMonthStartYmd);
  const [ventesDateTo, setVentesDateTo] = useState(() => formatYmd(new Date()));
  const [ventesPdfLoading, setVentesPdfLoading] = useState(false);
  const [ventesDepartmentId, setVentesDepartmentId] = useState<number | ''>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [resumeDateFrom, setResumeDateFrom] = useState(defaultMonthStartYmd);
  const [resumeDateTo, setResumeDateTo] = useState(() => formatYmd(new Date()));
  const [ventesResumeSnapshot, setVentesResumeSnapshot] = useState<DashboardBalanceSnapshot | null>(null);
  const [ventesResumeLoading, setVentesResumeLoading] = useState(false);
  const [txnDateFrom, setTxnDateFrom] = useState(defaultMonthStartYmd);
  const [txnDateTo, setTxnDateTo] = useState(() => formatYmd(new Date()));

  const [msg, setMsg] = useAutoClearMessage();

  const snapshot = useMemo(() => (dashboard ? dashboard[period] : null), [dashboard, period]);

  const salesByDepartmentGroups = useMemo(() => {
    const groups: { key: string; label: string; rows: DashboardSalesByProductRow[] }[] = [];
    for (const r of salesByProductRows) {
      const label = r.departmentName?.trim() || 'Sans département';
      const key = String(r.departmentId ?? 'none');
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else groups.push({ key, label, rows: [r] });
    }
    return groups;
  }, [salesByProductRows]);

  const ventesGrandTotal = useMemo(
    () => salesByProductRows.reduce((s, r) => s + r.totalSubtotal, 0),
    [salesByProductRows],
  );

  const salesTxnFilterParams = useMemo(() => {
    let createdFrom: string | undefined;
    let createdTo: string | undefined;
    if (txnDateFrom.trim()) createdFrom = ymdStartIso(txnDateFrom);
    if (txnDateTo.trim()) createdTo = ymdEndIso(txnDateTo);
    return { createdFrom, createdTo };
  }, [txnDateFrom, txnDateTo]);

  const salesListQuery = useMemo(
    () => ({
      ...salesTxnFilterParams,
      departmentId: ventesDepartmentId === '' ? undefined : Number(ventesDepartmentId),
    }),
    [salesTxnFilterParams, ventesDepartmentId],
  );

  const resumeTotalOutflows = useMemo(() => {
    if (!ventesResumeSnapshot) return 0;
    return (
      ventesResumeSnapshot.totalOutflows ??
      ventesResumeSnapshot.purchases + ventesResumeSnapshot.manualExpenses
    );
  }, [ventesResumeSnapshot]);

  const selectedCompanyName = useMemo(
    () => (companyId === '' ? undefined : companies.find((c) => c.id === companyId)?.name),
    [companies, companyId],
  );

  useEffect(() => {
    if (!isAdmin) return;
    void getCompanies()
      .then((list) => {
        setCompanies(list);
        setCompanyId((prev) => (prev !== '' ? prev : list[0]?.id ?? ''));
      })
      .catch(() => setMsg('Impossible de charger les entreprises.', { persist: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || companyId === '') {
      setDepartments([]);
      return;
    }
    void getDepartments(Number(companyId))
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [companyId, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (companyId === '') return;

    const cid = Number(companyId);
    setDashboardLoading(true);
    setAchatsTotalsDateFrom(defaultMonthStartYmd());
    setAchatsTotalsDateTo(formatYmd(new Date()));
    setAchatsTotalsSnapshot(null);
    setLedgerDateFrom(defaultMonthStartYmd());
    setLedgerDateTo(formatYmd(new Date()));
    setLedgerNature('all');
    setLedgerItems([]);
    setLedgerTotal(0);
    setLedgerSkip(0);
    setExpenseEntryDate(formatYmd(new Date()));
    setAlerts([]);
    setAlertsTotal(0);
    setAlertsSkip(0);
    setMovements([]);
    setMovementsTotal(0);
    setMovementsSkip(0);
    setMovementsPageSize(5);
    setMovementDateOrder('desc');
    setStockQuery('');
    setSales([]);
    setSalesTotal(0);
    setSalesSkip(0);
    setSaleModal(null);
    setSaleReceiptCompany(null);
    setSaleReceiptPrinter(null);
    setSalesByProductRows([]);
    setVentesDepartmentId('');
    setVentesResumeSnapshot(null);
    setVentesDateFrom(defaultMonthStartYmd());
    setVentesDateTo(formatYmd(new Date()));
    setResumeDateFrom(defaultMonthStartYmd());
    setResumeDateTo(formatYmd(new Date()));
    setTxnDateFrom(defaultMonthStartYmd());
    setTxnDateTo(formatYmd(new Date()));

    void Promise.all([
      getDashboardSummary({ companyId: cid }),
      getInventoryAlerts({ threshold: 5, companyId: cid, skip: 0, take: alertsTake }),
      getInventoryMovements({ companyId: cid, skip: 0, take: 5, order: 'desc' }),
    ])
      .then(([dash, a, mov]) => {
        setDashboard(dash);
        setAlerts(a.items);
        setAlertsTotal(a.total);
        setAlertsSkip(0);
        setMovements(mov.items);
        setMovementsTotal(mov.total);
      })
      .catch(() => setMsg('Impossible de charger le tableau de bord.', { persist: true }))
      .finally(() => setDashboardLoading(false));
  }, [companyId, isAdmin, setMsg]);

  useEffect(() => {
    if (!isAdmin || companyId === '' || tab !== 'ventes') return;
    if (!ventesDateFrom || !ventesDateTo || ventesDateFrom > ventesDateTo) return;
    setSalesByProductLoading(true);
    void getDashboardSalesByProduct({
      companyId: Number(companyId),
      dateFrom: ventesDateFrom,
      dateTo: ventesDateTo,
      departmentId: ventesDepartmentId === '' ? undefined : Number(ventesDepartmentId),
    })
      .then(setSalesByProductRows)
      .catch(() =>
        setMsg('Impossible de charger le détail des ventes par produit.', { persist: true }),
      )
      .finally(() => setSalesByProductLoading(false));
  }, [companyId, ventesDateFrom, ventesDateTo, ventesDepartmentId, tab, isAdmin, setMsg]);

  useEffect(() => {
    if (!isAdmin || companyId === '' || tab !== 'ventes') return;
    if (!resumeDateFrom || !resumeDateTo || resumeDateFrom > resumeDateTo) return;
    setVentesResumeLoading(true);
    void getDashboardSummaryRange({
      companyId: Number(companyId),
      dateFrom: resumeDateFrom,
      dateTo: resumeDateTo,
      departmentId: ventesDepartmentId === '' ? undefined : Number(ventesDepartmentId),
    })
      .then(setVentesResumeSnapshot)
      .catch(() =>
        setMsg('Impossible de charger le résumé financier (plage).', { persist: true }),
      )
      .finally(() => setVentesResumeLoading(false));
  }, [
    tab,
    companyId,
    resumeDateFrom,
    resumeDateTo,
    ventesDepartmentId,
    isAdmin,
    setMsg,
  ]);

  useEffect(() => {
    if (!isAdmin || companyId === '' || tab !== 'ventes') return;
    setSalesLoading(true);
    void listSales({
      companyId: Number(companyId),
      skip: 0,
      take: salesTake,
      ...salesListQuery,
    })
      .then((sal) => {
        setSales(sal.items);
        setSalesTotal(sal.total);
        setSalesSkip(0);
      })
      .catch(() => setMsg('Impossible de charger les transactions de vente.', { persist: true }))
      .finally(() => setSalesLoading(false));
  }, [companyId, salesListQuery, isAdmin, setMsg, tab]);

  useEffect(() => {
    if (!isAdmin || companyId === '' || tab !== 'achats') return;
    if (!achatsTotalsDateFrom || !achatsTotalsDateTo || achatsTotalsDateFrom > achatsTotalsDateTo) return;
    setAchatsTotalsLoading(true);
    void getDashboardSummaryRange({
      companyId: Number(companyId),
      dateFrom: achatsTotalsDateFrom,
      dateTo: achatsTotalsDateTo,
    })
      .then(setAchatsTotalsSnapshot)
      .catch(() =>
        setMsg('Impossible de charger les totaux achats / dépenses.', { persist: true }),
      )
      .finally(() => setAchatsTotalsLoading(false));
  }, [tab, companyId, achatsTotalsDateFrom, achatsTotalsDateTo, isAdmin, setMsg]);

  useEffect(() => {
    if (!isAdmin || companyId === '' || tab !== 'achats') return;
    if (!ledgerDateFrom || !ledgerDateTo || ledgerDateFrom > ledgerDateTo) return;
    setLedgerLoading(true);
    setLedgerSkip(0);
    void getFinanceLedger({
      companyId: Number(companyId),
      dateFrom: ledgerDateFrom,
      dateTo: ledgerDateTo,
      nature: ledgerNature,
      skip: 0,
      take: ledgerTake,
    })
      .then((res) => {
        setLedgerItems(res.items);
        setLedgerTotal(res.total);
        setLedgerSkip(0);
      })
      .catch(() => setMsg('Impossible de charger le journal unifié.', { persist: true }))
      .finally(() => setLedgerLoading(false));
  }, [tab, companyId, ledgerDateFrom, ledgerDateTo, ledgerNature, isAdmin, setMsg]);

  async function submitExpense(e: FormEvent) {
    e.preventDefault();
    if (companyId === '') return;
    setMsg('');
    const amount = Number(expenseAmount);
    if (!expenseDesc.trim() || !Number.isFinite(amount) || amount <= 0) return;

    try {
      await createFinanceEntry({
        type: 'EXPENSE',
        amount,
        description: expenseDesc.trim(),
        companyId: Number(companyId),
        entryDate: expenseEntryDate.trim() || undefined,
      });
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseEntryDate(formatYmd(new Date()));
      setMsg('Dépense enregistrée.');

      const cid = Number(companyId);
      const [dash, range, ledgerRes] = await Promise.all([
        getDashboardSummary({ companyId: cid }),
        getDashboardSummaryRange({
          companyId: cid,
          dateFrom: achatsTotalsDateFrom,
          dateTo: achatsTotalsDateTo,
        }),
        getFinanceLedger({
          companyId: cid,
          dateFrom: ledgerDateFrom,
          dateTo: ledgerDateTo,
          nature: ledgerNature,
          skip: 0,
          take: ledgerTake,
        }),
      ]);
      setDashboard(dash);
      setAchatsTotalsSnapshot(range);
      setLedgerItems(ledgerRes.items);
      setLedgerTotal(ledgerRes.total);
      setLedgerSkip(0);
    } catch {
      setMsg("Erreur lors de l'enregistrement.", { persist: true });
    }
  }

  async function loadMoreLedger() {
    if (ledgerLoading || companyId === '') return;
    if (ledgerSkip + ledgerTake >= ledgerTotal) return;
    setLedgerLoading(true);
    try {
      const cid = Number(companyId);
      const nextSkip = ledgerSkip + ledgerTake;
      const res = await getFinanceLedger({
        companyId: cid,
        dateFrom: ledgerDateFrom,
        dateTo: ledgerDateTo,
        nature: ledgerNature,
        skip: nextSkip,
        take: ledgerTake,
      });
      setLedgerItems((prev) => [...prev, ...res.items]);
      setLedgerSkip(nextSkip);
      setLedgerTotal(res.total);
    } catch {
      setMsg('Impossible de charger plus de lignes du journal.', { persist: true });
    } finally {
      setLedgerLoading(false);
    }
  }

  async function refetchMovementsFromStart(opts: { order: 'asc' | 'desc'; take: 5 | 10 }) {
    if (companyId === '') return;
    setMovementsLoading(true);
    try {
      const cid = Number(companyId);
      const mov = await getInventoryMovements({
        companyId: cid,
        skip: 0,
        take: opts.take,
        order: opts.order,
      });
      setMovements(mov.items);
      setMovementsTotal(mov.total);
      setMovementsSkip(0);
    } catch {
      setMsg('Impossible de recharger les mouvements.', { persist: true });
    } finally {
      setMovementsLoading(false);
    }
  }

  async function resetMovementsToInitial() {
    setMovementDateOrder('desc');
    setMovementsPageSize(5);
    await refetchMovementsFromStart({ order: 'desc', take: 5 });
  }

  async function loadMoreMovements() {
    if (movementsLoading || companyId === '') return;
    if (movementsSkip + movementsPageSize >= movementsTotal) return;
    setMovementsLoading(true);
    try {
      const cid = Number(companyId);
      const nextSkip = movementsSkip + movementsPageSize;
      const mov = await getInventoryMovements({
        companyId: cid,
        skip: nextSkip,
        take: movementsPageSize,
        order: movementDateOrder,
      });
      setMovements((prev) => [...prev, ...mov.items]);
      setMovementsSkip(nextSkip);
      setMovementsTotal(mov.total);
    } catch {
      setMsg('Impossible de charger plus de mouvements.', { persist: true });
    } finally {
      setMovementsLoading(false);
    }
  }

  async function loadMoreSales() {
    if (salesLoading || companyId === '') return;
    if (salesSkip + salesTake >= salesTotal) return;
    setSalesLoading(true);
    try {
      const cid = Number(companyId);
      const nextSkip = salesSkip + salesTake;
      const sal = await listSales({
        companyId: cid,
        skip: nextSkip,
        take: salesTake,
        ...salesListQuery,
      });
      setSales((prev) => [...prev, ...sal.items]);
      setSalesSkip(nextSkip);
      setSalesTotal(sal.total);
    } catch {
      setMsg('Impossible de charger plus de ventes.', { persist: true });
    } finally {
      setSalesLoading(false);
    }
  }

  async function exportVentesParProduitPdf() {
    if (companyId === '') return;
    if (!ventesDateFrom || !ventesDateTo || ventesDateFrom > ventesDateTo) {
      setMsg('Indiquez une plage de dates valide (du … au …).', { persist: true });
      return;
    }
    setVentesPdfLoading(true);
    setMsg('');
    try {
      const blob = await exportDashboardSalesByProductPdf({
        companyId: Number(companyId),
        dateFrom: ventesDateFrom,
        dateTo: ventesDateTo,
        departmentId: ventesDepartmentId === '' ? undefined : Number(ventesDepartmentId),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ventes-produits_${ventesDateFrom}_${ventesDateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Impossible d'exporter le PDF.", { persist: true });
    } finally {
      setVentesPdfLoading(false);
    }
  }

  async function confirmDeleteSale(sale: Sale) {
    if (companyId === '') return;
    const ok = window.confirm(
      `Supprimer définitivement la vente n°${sale.id} ?\n\n` +
        `Cette action est irréversible : la vente, les lignes, les paiements et l’écriture de caisse seront effacés de la base. ` +
        `Si la vente était encore « complétée », le stock sera rétabli (comme une annulation).`,
    );
    if (!ok) return;
    setSaleDeletingId(sale.id);
    setMsg('');
    try {
      await deleteSalePermanently(sale.id, Number(companyId));
      setSales((prev) => prev.filter((x) => x.id !== sale.id));
      setSalesTotal((t) => Math.max(0, t - 1));
      setSaleModal((m) => (m?.id === sale.id ? null : m));
      if (saleModal?.id === sale.id) {
        setSaleReceiptCompany(null);
        setSaleReceiptPrinter(null);
      }
      setMsg('Vente supprimée définitivement.');
    } catch {
      setMsg('Impossible de supprimer cette vente.', { persist: true });
    } finally {
      setSaleDeletingId(null);
    }
  }

  async function openSaleDetail(saleId: number) {
    if (saleDetailLoading) return;
    setSaleDetailLoading(true);
    setSaleModal(null);
    setSaleReceiptCompany(null);
    setSaleReceiptPrinter(null);
    try {
      const detail = await getSaleById(saleId);
      const first = detail.items?.[0]?.product;
      const cid = first?.companyId ?? (companyId !== '' ? Number(companyId) : undefined);
      const deptId = first?.departmentId ?? first?.department?.id ?? undefined;

      let co: CompanyProfile | null = null;
      let pr: DepartmentPrinterSettings | null = null;
      if (typeof cid === 'number') {
        try {
          co = await getCompanyById(cid);
        } catch {
          co = null;
        }
      }
      if (typeof deptId === 'number') {
        try {
          pr = await getPrinterSettings(deptId);
        } catch {
          pr = null;
        }
      }

      setSaleModal(detail);
      setSaleReceiptCompany(co);
      setSaleReceiptPrinter(pr);
    } catch {
      setMsg('Impossible de charger le détail de la vente.', { persist: true });
    } finally {
      setSaleDetailLoading(false);
    }
  }

  async function loadMoreAlerts() {
    if (alertsLoading || companyId === '') return;
    if (alertsSkip + alertsTake >= alertsTotal) return;
    setAlertsLoading(true);
    try {
      const cid = Number(companyId);
      const nextSkip = alertsSkip + alertsTake;
      const a = await getInventoryAlerts({
        threshold: 5,
        companyId: cid,
        skip: nextSkip,
        take: alertsTake,
      });
      setAlerts((prev) => [...prev, ...a.items]);
      setAlertsSkip(nextSkip);
      setAlertsTotal(a.total);
    } catch {
      setMsg("Impossible de charger plus d'alertes.", { persist: true });
    } finally {
      setAlertsLoading(false);
    }
  }

  const filteredMovements = useMemo(() => {
    if (!stockQuery.trim()) return movements;
    const q = stockQuery.trim().toLowerCase();
    return movements.filter((m) => {
      const name = m.product?.name ?? '';
      const reason = m.reason ?? '';
      return name.toLowerCase().includes(q) || reason.toLowerCase().includes(q);
    });
  }, [movements, stockQuery]);

  const periodLabel = (p: PeriodId) => {
    switch (p) {
      case 'day':
        return "Aujourd'hui";
      case 'week':
        return '7 derniers jours';
      case 'month':
        return 'Mois en cours';
    }
  };

  if (!isAdmin) {
    return (
      <div className="page-inner">
        <p className="info-text">Accès réservé à l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="page-inner">
      <header className="page-header">
        <h1>Tableau de bord (ADMIN)</h1>
       
      </header>

      <div className="config-tabs" style={{ marginBottom: '0.9rem' }}>
        {(
          [
            ['ventes', 'Ventes'],
            ['stock', 'Stock & Mouvements'],
            ['achats', 'Achats & Dépenses'],
            ['synthese', 'Synthèse'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        className="grid"
        style={{
          gridTemplateColumns:
            tab === 'synthese' ? 'minmax(240px, 1fr)' : 'minmax(240px, 1fr) minmax(240px, 1fr)',
          gap: '0.9rem',
        }}
      >
        <div className="card" style={{ padding: '0.9rem 1.1rem' }}>
          <label style={{ marginBottom: 0 }}>
            Entreprise
            <select
              value={companyId === '' ? '' : String(companyId)}
              onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : '')}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tab === 'ventes' ? (
          <div className="card" style={{ padding: '0.9rem 1.1rem' }}>
            <label style={{ marginBottom: 0 }}>
              Département
              <select
                value={ventesDepartmentId === '' ? '' : String(ventesDepartmentId)}
                onChange={(e) => setVentesDepartmentId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Tous les départements</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : tab === 'synthese' ? null : (
          <div className="card" style={{ padding: '0.9rem 1.1rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={period === p ? 'tab active' : 'tab'}
                  onClick={() => setPeriod(p)}
                >
                  {periodLabel(p)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {msg ? <p className="info-text" style={{ marginTop: '0.9rem' }}>{msg}</p> : null}

      {companyId === '' ? (
        <p className="info-text" style={{ marginTop: '0.9rem' }}>Chargement du dashboard…</p>
      ) : tab !== 'ventes' && tab !== 'achats' && (dashboardLoading || !snapshot) ? (
        <p className="info-text" style={{ marginTop: '0.9rem' }}>Chargement du dashboard…</p>
      ) : (
        <>
          {snapshot && tab === 'synthese' && dashboard ? (
            <DashboardSyntheseTab
              companyId={Number(companyId)}
              companyName={selectedCompanyName}
              departments={departments}
              onMessage={setMsg}
            />
          ) : null}

          {tab === 'ventes' ? (
            <>
              <section className="card" style={{ marginTop: '1rem' }}>
                <h2>Ventes</h2>
                <p className="page-lead" style={{ marginTop: 0 }}>
                  Entreprise : <strong>{selectedCompanyName ?? '—'}</strong>. Totaux par département puis par article.
                  Ajustez la plage de dates pour recalculer le rapport et l’export PDF.
                </p>
                <div
                  className="form-grid inline"
                  style={{
                    marginBottom: '0.85rem',
                    alignItems: 'end',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  }}
                >
                  <label>
                    Date début
                    <input
                      type="date"
                      value={ventesDateFrom}
                      onChange={(e) => setVentesDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Date fin
                    <input
                      type="date"
                      value={ventesDateTo}
                      onChange={(e) => setVentesDateTo(e.target.value)}
                    />
                  </label>
                  <div style={{ justifySelf: 'start' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={ventesPdfLoading || salesByProductLoading || ventesDateFrom > ventesDateTo}
                      onClick={() => void exportVentesParProduitPdf()}
                    >
                      {ventesPdfLoading ? 'Export PDF…' : 'Exporter PDF'}
                    </button>
                  </div>
                </div>
                {ventesDateFrom > ventesDateTo ? (
                  <p className="info-text">La date de fin doit être au moins égale à la date de début.</p>
                ) : null}
                {salesByProductLoading && salesByProductRows.length === 0 ? (
                  <p className="info-text">Chargement du détail…</p>
                ) : salesByProductRows.length === 0 ? (
                  <p className="info-text">Aucune vente sur cette plage pour cette entreprise.</p>
                ) : (
                  <>
                    {salesByDepartmentGroups.map((g) => {
                      const deptTotal = g.rows.reduce((s, r) => s + r.totalSubtotal, 0);
                      return (
                        <div key={g.key} style={{ marginTop: '1.25rem' }}>
                          <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>{g.label}</h3>
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Produit / service</th>
                                  <th>Type</th>
                                  <th>Qté (base)</th>
                                  <th>Total vendu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((r) => (
                                  <tr key={r.productId}>
                                    <td>{r.productName}</td>
                                    <td>{r.isService ? 'Service' : 'Produit'}</td>
                                    <td className="journal-amt">{r.quantity.toFixed(3)}</td>
                                    <td className="journal-amt">{r.totalSubtotal.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={3}>
                                    <strong>Sous-total {g.label}</strong>
                                  </td>
                                  <td className="journal-amt">
                                    <strong>{deptTotal.toFixed(2)}</strong>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                    <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
                      <table className="data-table">
                        <tbody>
                          <tr>
                            <td colSpan={3}>
                              <strong>Total général ({ventesDateFrom} → {ventesDateTo})</strong>
                            </td>
                            <td className="journal-amt">
                              <strong>{ventesGrandTotal.toFixed(2)}</strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section className="card" style={{ marginTop: '1rem' }}>
                <h2>Résumé financier</h2>
                <p className="page-lead" style={{ marginTop: 0 }}>
                  Même entreprise et département qu’en tête de page. Les achats et ventes sont filtrés par département ; les
                  dépenses manuelles restent au périmètre entreprise.
                </p>
                <div
                  className="form-grid inline"
                  style={{
                    marginBottom: '0.85rem',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  }}
                >
                  <label>
                    Date début
                    <input
                      type="date"
                      value={resumeDateFrom}
                      onChange={(e) => setResumeDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Date fin
                    <input
                      type="date"
                      value={resumeDateTo}
                      onChange={(e) => setResumeDateTo(e.target.value)}
                    />
                  </label>
                </div>
                {resumeDateFrom > resumeDateTo ? (
                  <p className="info-text">La date de fin doit être au moins égale à la date de début.</p>
                ) : null}
                {ventesResumeLoading && !ventesResumeSnapshot ? (
                  <p className="info-text">Chargement du résumé…</p>
                ) : !ventesResumeSnapshot ? (
                  <p className="info-text">—</p>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.65rem',
                        flexWrap: 'wrap',
                        alignItems: 'stretch',
                      }}
                    >
                      <div
                        style={{
                          flex: '1 1 120px',
                          minWidth: 100,
                          padding: '0.4rem 0.65rem',
                          borderRadius: 8,
                          border: '1px solid #a7f3d0',
                          background: 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: '#047857',
                            fontWeight: 600,
                          }}
                        >
                          Revenus
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#065f46', lineHeight: 1.2 }}>
                          {ventesResumeSnapshot.sales.toFixed(2)}
                        </div>
                      </div>
                      <div
                        style={{
                          flex: '1 1 120px',
                          minWidth: 100,
                          padding: '0.4rem 0.65rem',
                          borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: '#b91c1c',
                            fontWeight: 600,
                          }}
                        >
                          Sorties
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#991b1b', lineHeight: 1.2 }}>
                          {resumeTotalOutflows.toFixed(2)}
                        </div>
                      </div>
                      <div
                        style={{
                          flex: '1 1 120px',
                          minWidth: 100,
                          padding: '0.4rem 0.65rem',
                          borderRadius: 8,
                          border:
                            ventesResumeSnapshot.balance < 0 ? '1px solid #fecaca' : '1px solid #bfdbfe',
                          background:
                            ventesResumeSnapshot.balance < 0
                              ? 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)'
                              : 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.68rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: ventesResumeSnapshot.balance < 0 ? '#b45309' : '#1d4ed8',
                            fontWeight: 600,
                          }}
                        >
                          Résultat net
                        </div>
                        <div
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            color: ventesResumeSnapshot.balance < 0 ? '#b91c1c' : '#1e3a8a',
                            lineHeight: 1.2,
                          }}
                        >
                          {ventesResumeSnapshot.balance.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <p className="dept-hint" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
                      Période : {resumeDateFrom} → {resumeDateTo}. Détail sorties : achats reçus{' '}
                      {ventesResumeSnapshot.purchases.toFixed(2)} · dépenses manuelles{' '}
                      {ventesResumeSnapshot.manualExpenses.toFixed(2)}
                    </p>
                  </>
                )}
              </section>

              <section className="card" style={{ marginTop: '1rem' }}>
                <h2>Transactions de vente</h2>
                <p className="page-lead" style={{ marginTop: 0 }}>
                  Une ligne par ticket. Dates inclusives (jour entier) ; laissez une borne vide pour ne pas filtrer de ce
                  côté. Cliquez une ligne pour le détail et le PDF ticket.
                </p>
                <div
                  className="form-grid inline"
                  style={{
                    marginBottom: '0.85rem',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  }}
                >
                  <label>
                    Date début
                    <input
                      type="date"
                      value={txnDateFrom}
                      onChange={(e) => setTxnDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Date fin
                    <input
                      type="date"
                      value={txnDateTo}
                      onChange={(e) => setTxnDateTo(e.target.value)}
                    />
                  </label>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Total</th>
                        <th>Caissier</th>
                        <th>Statut</th>
                        {isAdmin ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {salesLoading && sales.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6}>Chargement…</td>
                        </tr>
                      ) : sales.length === 0 ? (
                        <tr>
                          <td colSpan={isAdmin ? 7 : 6}>Aucune vente pour cette entreprise.</td>
                        </tr>
                      ) : (
                        sales.map((s) => (
                          <tr
                            key={s.id}
                            className="dashboard-sale-row"
                            onClick={() => void openSaleDetail(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void openSaleDetail(s.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>{s.id}</td>
                            <td>{new Date(s.createdAt).toLocaleString()}</td>
                            <td>{(s.clientName && s.clientName.trim()) || '—'}</td>
                            <td className="journal-amt">{Number(s.total).toFixed(2)}</td>
                            <td>
                              <small>{s.user?.fullName?.trim() || s.cashier || s.user?.phone || '—'}</small>
                            </td>
                            <td>{s.status}</td>
                            {isAdmin ? (
                              <td
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  disabled={saleDeletingId === s.id}
                                  aria-label={`Supprimer définitivement la vente n°${s.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void confirmDeleteSale(s);
                                  }}
                                >
                                  {saleDeletingId === s.id ? '…' : 'Supprimer'}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {sales.length > 0 ? (
                  <p className="dept-hint" style={{ marginBottom: 0 }}>
                    Affichage {sales.length} / {salesTotal} vente{salesTotal > 1 ? 's' : ''}.
                  </p>
                ) : null}

                {salesSkip + salesTake < salesTotal ? (
                  <div className="table-actions" style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void loadMoreSales()}
                      disabled={salesLoading}
                    >
                      {salesLoading ? 'Chargement…' : 'Charger plus'}
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {tab === 'achats' ? (
            <>
              <section className="grid two-col" style={{ marginTop: '1rem' }}>
                <div className="card">
                  <h2>Nouvelle dépense manuelle</h2>
                  <p className="dept-hint" style={{ marginTop: 0 }}>
                    Entreprise : <strong>{selectedCompanyName ?? '—'}</strong>. La dépense est enregistrée avec votre
                    identifiant ({sessionUser?.fullName?.trim() || sessionUser?.phone || '—'}). La date comptable est
                    celle choisie ci-dessous (stockée en base sur la ligne financière).
                  </p>
                  <form className="form-grid" onSubmit={(e) => void submitExpense(e)}>
                    <label>
                      Libellé
                      <input value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} required />
                    </label>
                    <label>
                      Montant
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Date de la dépense
                      <input
                        type="date"
                        value={expenseEntryDate}
                        onChange={(e) => setExpenseEntryDate(e.target.value)}
                        required
                      />
                    </label>
                    <button type="submit" className="btn btn-primary">
                      Enregistrer
                    </button>
                  </form>
                </div>

                <div className="card">
                  <h2>Totaux (achats & dépenses manuelles)</h2>
                  <p className="dept-hint" style={{ marginTop: 0 }}>
                    Filtrez par plage de dates (inclusif). Les ventes du tableau ne sont pas affichées ici ; elles sont
                    dans l’onglet Ventes.
                  </p>
                  <div
                    className="form-grid inline"
                    style={{
                      marginBottom: '0.85rem',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    }}
                  >
                    <label>
                      Date début
                      <input
                        type="date"
                        value={achatsTotalsDateFrom}
                        onChange={(e) => setAchatsTotalsDateFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      Date fin
                      <input
                        type="date"
                        value={achatsTotalsDateTo}
                        onChange={(e) => setAchatsTotalsDateTo(e.target.value)}
                      />
                    </label>
                  </div>
                  {achatsTotalsLoading || !achatsTotalsSnapshot ? (
                    <p className="dept-hint" style={{ marginBottom: 0 }}>
                      Chargement des totaux…
                    </p>
                  ) : achatsTotalsDateFrom > achatsTotalsDateTo ? (
                    <p className="dept-hint" style={{ marginBottom: 0 }}>
                      La date de début doit précéder la date de fin.
                    </p>
                  ) : (
                    <section className="grid kpis" style={{ marginBottom: 0 }}>
                      <div className="card kpi">
                        <div className="kpi-label">Achats reçus</div>
                        <div className="kpi-value">{achatsTotalsSnapshot.purchases.toFixed(2)}</div>
                      </div>
                      <div className="card kpi">
                        <div className="kpi-label">Dépenses manuelles</div>
                        <div className="kpi-value">{achatsTotalsSnapshot.manualExpenses.toFixed(2)}</div>
                      </div>
                    </section>
                  )}
                </div>
              </section>

              <section className="card" style={{ marginTop: '1rem' }}>
                <h2>Journal (achats, ventes caisse, dépenses)</h2>
                <p className="page-lead" style={{ marginTop: 0 }}>
                  Filtrez par nature et par plage de dates. Les achats sont les réceptions postées ; les ventes sont les
                  encaissements liés aux tickets ; les dépenses incluent les sorties manuelles.
                </p>
                <div
                  className="form-grid inline"
                  style={{
                    marginBottom: '0.85rem',
                    alignItems: 'end',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  }}
                >
                  <label>
                    Nature
                    <select
                      value={ledgerNature}
                      onChange={(e) =>
                        setLedgerNature(e.target.value as 'all' | 'purchase' | 'sale' | 'expense')
                      }
                    >
                      <option value="all">Toutes</option>
                      <option value="purchase">Achats</option>
                      <option value="sale">Ventes (caisse)</option>
                      <option value="expense">Dépenses</option>
                    </select>
                  </label>
                  <label>
                    Date début
                    <input
                      type="date"
                      value={ledgerDateFrom}
                      onChange={(e) => setLedgerDateFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Date fin
                    <input
                      type="date"
                      value={ledgerDateTo}
                      onChange={(e) => setLedgerDateTo(e.target.value)}
                    />
                  </label>
                </div>
                <p className="dept-hint" style={{ marginTop: 0 }}>
                  {ledgerTotal === 0
                    ? 'Aucune ligne sur cette plage.'
                    : `Affichage ${ledgerItems.length} / ${ledgerTotal} ligne${ledgerTotal > 1 ? 's' : ''}.`}
                </p>
                <ul className="journal-list">
                  {ledgerLoading && ledgerItems.length === 0 ? (
                    <li className="journal-row">
                      <span>Chargement…</span>
                      <span />
                      <span />
                    </li>
                  ) : ledgerItems.length === 0 ? (
                    <li className="journal-row">
                      <span>Aucune entrée</span>
                      <span />
                      <span />
                    </li>
                  ) : (
                    ledgerItems.map((row) => (
                      <li key={row.id} className="journal-row">
                        <span className={`journal-type ${row.kind.toLowerCase()}`}>
                          {row.kind === 'PURCHASE'
                            ? 'Achat'
                            : row.kind === 'SALE'
                              ? 'Vente'
                              : 'Dépense'}
                        </span>
                        <span>
                          <span>{row.description}</span>
                          <span className="dept-hint" style={{ display: 'block', marginTop: '0.2rem' }}>
                            {new Date(row.occurredAt).toLocaleString()} ·{' '}
                            {row.user?.fullName?.trim() || row.user?.phone || '—'}
                          </span>
                        </span>
                        <span className="journal-amt">{row.amount.toFixed(2)}</span>
                      </li>
                    ))
                  )}
                </ul>
                {ledgerItems.length > 0 && ledgerSkip + ledgerTake < ledgerTotal ? (
                  <div className="table-actions" style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void loadMoreLedger()}
                      disabled={ledgerLoading}
                    >
                      {ledgerLoading ? 'Chargement…' : 'Charger plus'}
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {tab === 'stock' ? (
            <>
              <section className="grid two-col" style={{ marginTop: '1rem' }}>
              <section className="card alert-banner alerts-accordion">
                <button
                  type="button"
                  className="alerts-accordion-trigger"
                  id="alerts-stock-faible-heading"
                  aria-expanded={alertsOpen}
                  aria-controls="alerts-stock-faible-panel"
                  onClick={() => setAlertsOpen((o) => !o)}
                  disabled={alerts.length === 0}
                >
                  <span className="alerts-accordion-title">
                    Alertes stock faible
                    <span className="alerts-count">{alertsTotal}</span>
                  </span>
                  <span
                    className={`catalog-accordion-chevron${alertsOpen ? ' is-open' : ''}`}
                    aria-hidden
                  />
                </button>

                {alerts.length > 0 && alertsOpen ? (
                  <div
                    className="alerts-accordion-panel"
                    id="alerts-stock-faible-panel"
                    role="region"
                    aria-labelledby="alerts-stock-faible-heading"
                  >
                    <ul className="alerts-list">
                      {alerts.map((p) => (
                        <li key={p.id}>
                          {p.name} — {Number(p.stock).toFixed(3)} (min {Number(p.stockMin).toFixed(3)})
                        </li>
                      ))}
                    </ul>
                    {alertsSkip + alertsTake < alertsTotal ? (
                      <div className="table-actions" style={{ marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void loadMoreAlerts()}
                          disabled={alertsLoading}
                        >
                          {alertsLoading ? 'Chargement…' : 'Charger plus'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="alerts-accordion-panel" style={{ paddingTop: '0.9rem' }}>
                    <p className="page-lead" style={{ margin: 0 }}>
                      Aucun produit sous le stock minimum.
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="card">
                <h2>Mouvements récents (stock)</h2>
                <p className="page-lead" style={{ marginTop: 0 }}>
                  Filtrés par entreprise. Tri et pagination côté serveur ; la recherche filtre les lignes déjà chargées.
                </p>

                <div className="form-grid inline" style={{ marginBottom: '0.75rem' }}>
                  <label style={{ gridColumn: '1 / span 2' }}>
                    Recherche (lignes affichées)
                    <input value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} placeholder="Ex. réception, ajustement, produit…" />
                  </label>
                  <label>
                    Tri par date
                    <select
                      value={movementDateOrder}
                      onChange={(e) => {
                        const v = e.target.value as 'asc' | 'desc';
                        setMovementDateOrder(v);
                        void refetchMovementsFromStart({ order: v, take: movementsPageSize });
                      }}
                    >
                      <option value="desc">Plus récent d’abord</option>
                      <option value="asc">Plus ancien d’abord</option>
                    </select>
                  </label>
                  <label>
                    Lignes par chargement
                    <select
                      value={movementsPageSize}
                      onChange={(e) => {
                        const v = e.target.value === '10' ? 10 : 5;
                        setMovementsPageSize(v);
                        void refetchMovementsFromStart({ order: movementDateOrder, take: v });
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </label>
                  <div style={{ alignSelf: 'end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={movementsLoading}
                      onClick={() => void resetMovementsToInitial()}
                    >
                      Réinitialiser
                    </button>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p className="dept-hint" style={{ margin: 0 }}>
                      {filteredMovements.length} ligne{filteredMovements.length > 1 ? 's' : ''} affichée
                      {filteredMovements.length > 1 ? 's' : ''} (recherche locale)
                    </p>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Produit</th>
                        <th>Qté</th>
                        <th>Unité</th>
                        <th>Motif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementsLoading && movements.length === 0 ? (
                        <tr>
                          <td colSpan={6}>Chargement…</td>
                        </tr>
                      ) : filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6}>Aucun mouvement.</td>
                        </tr>
                      ) : (
                        filteredMovements.map((m) => (
                          <tr key={m.id}>
                            <td>{new Date(m.createdAt).toLocaleString()}</td>
                            <td>{movementTypeLabel(m.type)}</td>
                            <td>{m.product?.name ?? `#${m.productId}`}</td>
                            <td className="journal-amt">{Number(m.quantity).toFixed(3)}</td>
                            <td>
                              <small>{stockPackagingLabelFromMovementProduct(m.product)}</small>
                            </td>
                            <td>{movementReasonLabel(m.reason)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {movements.length > 0 ? (
                  <p className="dept-hint" style={{ marginBottom: 0 }}>
                    Chargées {movements.length} / {movementsTotal} au total · pas de {movementsPageSize} · tri date{' '}
                    {movementDateOrder === 'desc' ? '(récent → ancien)' : '(ancien → récent)'}
                    {stockQuery.trim() ? ' · recherche appliquée sur la liste chargée' : ''}.
                  </p>
                ) : null}

                {movementsSkip + movementsPageSize < movementsTotal ? (
                  <div className="table-actions" style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => void loadMoreMovements()}>
                      {movementsLoading ? 'Chargement…' : 'Charger plus'}
                    </button>
                  </div>
                ) : null}
              </section>
            </section>
            </>
          ) : null}
        </>
      )}

      <SaleDetailModal
        sale={saleModal}
        companyName={selectedCompanyName}
        company={saleReceiptCompany}
        printer={saleReceiptPrinter}
        onClose={() => {
          setSaleModal(null);
          setSaleReceiptCompany(null);
          setSaleReceiptPrinter(null);
        }}
      />
    </div>
  );
}
