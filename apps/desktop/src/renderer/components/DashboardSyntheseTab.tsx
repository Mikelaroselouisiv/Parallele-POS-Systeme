import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  exportFinancialSynthesisPdf,
  getDashboardSalesByProduct,
  getDashboardSummaryRange,
} from '../services/api';
import type { DashboardBalanceSnapshot, DashboardSalesByProductRow, Department } from '../types/api';

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

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

function fmtMoney(n: number) {
  return `${n.toFixed(2)}`;
}

type Props = {
  companyId: number;
  companyName: string | undefined;
  departments: Department[];
  onMessage: (msg: string, opts?: { persist?: boolean }) => void;
};

export function DashboardSyntheseTab({ companyId, companyName, departments, onMessage }: Props) {
  const [dateFrom, setDateFrom] = useState(defaultMonthStartYmd);
  const [dateTo, setDateTo] = useState(() => formatYmd(new Date()));
  const [departmentId, setDepartmentId] = useState<number | ''>('');

  const [rangeSnap, setRangeSnap] = useState<DashboardBalanceSnapshot | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rows, setRows] = useState<DashboardSalesByProductRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const [productQuery, setProductQuery] = useState('');
  const [sortKey, setSortKey] = useState<'productName' | 'totalSubtotal' | 'quantity'>('totalSubtotal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [synthesisPdfLoading, setSynthesisPdfLoading] = useState(false);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setRangeLoading(true);
    void getDashboardSummaryRange({
      companyId,
      dateFrom,
      dateTo,
      departmentId: departmentId === '' ? undefined : Number(departmentId),
    })
      .then(setRangeSnap)
      .catch(() => onMessage('Impossible de charger la synthèse financière.', { persist: true }))
      .finally(() => setRangeLoading(false));
  }, [companyId, dateFrom, dateTo, departmentId, onMessage]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    setRowsLoading(true);
    void getDashboardSalesByProduct({
      companyId,
      dateFrom,
      dateTo,
      departmentId: departmentId === '' ? undefined : Number(departmentId),
    })
      .then(setRows)
      .catch(() => onMessage('Impossible de charger le détail par article.', { persist: true }))
      .finally(() => setRowsLoading(false));
  }, [companyId, dateFrom, dateTo, departmentId, onMessage]);

  const marginPct = useMemo(() => {
    if (!rangeSnap || rangeSnap.sales <= 0) return null;
    return (rangeSnap.balance / rangeSnap.sales) * 100;
  }, [rangeSnap]);

  const flowBars = useMemo(() => {
    if (!rangeSnap) return [];
    return [
      { name: 'Ventes', value: rangeSnap.sales, fill: '#10b981' },
      { name: 'Achats', value: rangeSnap.purchases, fill: '#f59e0b' },
      { name: 'Dépenses', value: rangeSnap.manualExpenses, fill: '#f43f5e' },
      { name: 'Résultat', value: rangeSnap.balance, fill: rangeSnap.balance >= 0 ? '#0ea5e9' : '#dc2626' },
    ];
  }, [rangeSnap]);

  const pieSlices = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.totalSubtotal - a.totalSubtotal).slice(0, 8);
    return sorted.map((r) => ({
      name: r.productName.length > 28 ? `${r.productName.slice(0, 26)}…` : r.productName,
      value: r.totalSubtotal,
    }));
  }, [rows]);

  const filteredSortedRows = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    let list = q
      ? rows.filter((r) => r.productName.toLowerCase().includes(q))
      : [...rows];
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === 'productName') return a.productName.localeCompare(b.productName, 'fr') * mul;
      if (sortKey === 'quantity') return (a.quantity - b.quantity) * mul;
      return (a.totalSubtotal - b.totalSubtotal) * mul;
    });
    return list;
  }, [rows, productQuery, sortKey, sortDir]);

  const grandTotal = useMemo(() => filteredSortedRows.reduce((s, r) => s + r.totalSubtotal, 0), [filteredSortedRows]);

  async function downloadSynthesisPdf() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      onMessage('Indiquez une plage de dates valide.', { persist: true });
      return;
    }
    setSynthesisPdfLoading(true);
    onMessage('');
    try {
      const blob = await exportFinancialSynthesisPdf({
        companyId,
        dateFrom,
        dateTo,
        departmentId: departmentId === '' ? undefined : Number(departmentId),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `synthese-financiere_${companyId}_${dateFrom}_${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onMessage("Impossible d'exporter le PDF de synthèse.", { persist: true });
    } finally {
      setSynthesisPdfLoading(false);
    }
  }

  const invalidRange = !dateFrom || !dateTo || dateFrom > dateTo;

  return (
    <div className="synthese-tab">
      <section className="synthese-hero card">
        <div className="synthese-hero-inner">
          <div>
            <h2 className="synthese-hero-title">Pilotage &amp; synthèse</h2>
            <p className="synthese-hero-lead">
              Vue d’ensemble pour le dirigeant, le comptable ou le contrôle de gestion : indicateurs, répartition des
              flux et performance par article sur la période de votre choix.
            </p>
            <p className="dept-hint" style={{ marginBottom: 0 }}>
              Entreprise : <strong>{companyName ?? '—'}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="card synthese-toolbar" style={{ marginTop: '1rem' }}>
        <div className="synthese-toolbar-row">
          <p className="dept-hint" style={{ margin: 0, flex: '1 1 12rem' }}>
            Période : utilisez les champs <strong>date début</strong> et <strong>date fin</strong> ci-dessous (toutes les
            analyses et l’export PDF suivent cette plage).
          </p>
          <div className="synthese-export-wrap">
            <button
              type="button"
              className="btn btn-primary"
              disabled={synthesisPdfLoading || invalidRange || rangeLoading}
              onClick={() => void downloadSynthesisPdf()}
            >
              {synthesisPdfLoading ? 'Export PDF…' : 'Exporter la synthèse (PDF)'}
            </button>
          </div>
        </div>
        <div
          className="form-grid inline synthese-filters"
          style={{ marginTop: '0.85rem', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          <label>
            Date début
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            Date fin
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label>
            Département
            <select
              value={departmentId === '' ? '' : String(departmentId)}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Tous</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {invalidRange ? (
          <p className="dept-hint" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            Ajustez les dates pour afficher les graphiques et le tableau.
          </p>
        ) : null}
      </section>

      {invalidRange ? null : (
        <>
          <section className="grid synthese-kpi-grid" style={{ marginTop: '1rem' }}>
            <div className="card synthese-kpi synthese-kpi--sales">
              <div className="synthese-kpi-label">Chiffre d’affaires</div>
              <div className="synthese-kpi-value">
                {rangeLoading || !rangeSnap ? '…' : fmtMoney(rangeSnap.sales)}
              </div>
            </div>
            <div className="card synthese-kpi synthese-kpi--out">
              <div className="synthese-kpi-label">Total sorties</div>
              <div className="synthese-kpi-value">
                {rangeLoading || !rangeSnap ? '…' : fmtMoney(rangeSnap.totalOutflows)}
              </div>
              <div className="synthese-kpi-sub">
                {rangeSnap && !rangeLoading
                  ? `Achats ${fmtMoney(rangeSnap.purchases)} · Dép. ${fmtMoney(rangeSnap.manualExpenses)}`
                  : ''}
              </div>
            </div>
            <div className="card synthese-kpi synthese-kpi--result">
              <div className="synthese-kpi-label">Résultat net</div>
              <div
                className="synthese-kpi-value"
                style={{ color: rangeSnap && rangeSnap.balance < 0 ? '#dc2626' : '#0f172a' }}
              >
                {rangeLoading || !rangeSnap ? '…' : fmtMoney(rangeSnap.balance)}
              </div>
              {marginPct != null ? (
                <div className="synthese-kpi-sub">Marge sur CA : {marginPct.toFixed(1)} %</div>
              ) : null}
            </div>
          </section>

          <section className="grid two-col synthese-charts-grid" style={{ marginTop: '1rem' }}>
            <div className="card synthese-chart-card">
              <h3 className="synthese-chart-title">Structure des flux (période sélectionnée)</h3>
              <p className="dept-hint" style={{ marginTop: 0 }}>
                Ventes, achats reçus, dépenses manuelles et résultat sur la même échelle.
              </p>
              <div className="synthese-chart-area">
                {rangeLoading || !rangeSnap ? (
                  <p className="dept-hint">Chargement…</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={flowBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)}`, '']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {flowBars.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card synthese-chart-card">
              <h3 className="synthese-chart-title">Top articles (CA)</h3>
              <p className="dept-hint" style={{ marginTop: 0 }}>
                Huit plus gros contributeurs au chiffre d’affaires sur la période.
              </p>
              <div className="synthese-chart-area">
                {rowsLoading ? (
                  <p className="dept-hint">Chargement…</p>
                ) : pieSlices.length === 0 ? (
                  <p className="dept-hint">Pas assez de données pour un camembert.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieSlices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {pieSlices.map((_, i) => (
                          <Cell key={String(i)} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v.toFixed(2)}`} />
                      <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <section className="card" style={{ marginTop: '1rem' }}>
            <h3 className="synthese-chart-title">Détail des ventes par article</h3>
            <p className="dept-hint" style={{ marginTop: 0 }}>
              Filtrez par nom, triez par colonne. Les totaux se mettent à jour selon le filtre texte.
            </p>
            <div
              className="form-grid inline"
              style={{
                marginBottom: '0.85rem',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                alignItems: 'end',
              }}
            >
              <label style={{ gridColumn: 'span 2' }}>
                Rechercher un article
                <input
                  type="search"
                  placeholder="Nom du produit ou service…"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                />
              </label>
              <label>
                Trier par
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                >
                  <option value="totalSubtotal">Montant (CA)</option>
                  <option value="quantity">Quantité</option>
                  <option value="productName">Nom</option>
                </select>
              </label>
              <label>
                Ordre
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
                  <option value="desc">Décroissant</option>
                  <option value="asc">Croissant</option>
                </select>
              </label>
            </div>

            {rowsLoading ? (
              <p className="dept-hint">Chargement du détail…</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data-table synthese-table">
                    <thead>
                      <tr>
                        <th>Article</th>
                        <th>Département</th>
                        <th>Type</th>
                        <th className="journal-amt">Qté</th>
                        <th className="journal-amt">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            {productQuery.trim() ? 'Aucun article ne correspond au filtre.' : 'Aucune ligne.'}
                          </td>
                        </tr>
                      ) : (
                        filteredSortedRows.map((r) => (
                          <tr key={`${r.productId}-${r.departmentId ?? 'x'}`}>
                            <td>{r.productName}</td>
                            <td>{(r.departmentName && r.departmentName.trim()) || '—'}</td>
                            <td>{r.isService ? 'Service' : 'Produit'}</td>
                            <td className="journal-amt">{r.quantity.toFixed(3)}</td>
                            <td className="journal-amt">{r.totalSubtotal.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="dept-hint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  {filteredSortedRows.length} ligne{filteredSortedRows.length > 1 ? 's' : ''} · Total filtré :{' '}
                  <strong>{grandTotal.toFixed(2)}</strong>
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
