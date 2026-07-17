import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { StockMovementRow } from '../types/api';
import { formatUserLabel } from '../utils/userAttribution';
import { formatQuantity } from '../utils/formatQuantity';
import { stockPackagingLabelFromMovementProduct } from '../utils/packagingDisplay';

const TYPE_COLORS = {
  IN: '#10b981',
  OUT: '#f43f5e',
  ADJUSTMENT: '#f59e0b',
} as const;

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

type Props = {
  movements: StockMovementRow[];
  filteredMovements: StockMovementRow[];
  movementsTotal: number;
  movementsSkip: number;
  movementsPageSize: 5 | 10;
  movementDateOrder: 'asc' | 'desc';
  stockQuery: string;
  loading: boolean;
  onStockQueryChange: (value: string) => void;
  onOrderChange: (order: 'asc' | 'desc') => void;
  onPageSizeChange: (size: 5 | 10) => void;
  onReset: () => void;
  onLoadMore: () => void;
};

export function StockMovementsPanel({
  movements,
  filteredMovements,
  movementsTotal,
  movementsSkip,
  movementsPageSize,
  movementDateOrder,
  stockQuery,
  loading,
  onStockQueryChange,
  onOrderChange,
  onPageSizeChange,
  onReset,
  onLoadMore,
}: Props) {
  const typeStats = useMemo(() => {
    const counts = { IN: 0, OUT: 0, ADJUSTMENT: 0 };
    for (const m of filteredMovements) {
      counts[m.type] += 1;
    }
    return [
      { key: 'IN' as const, label: 'Entrées', value: counts.IN, fill: TYPE_COLORS.IN },
      { key: 'OUT' as const, label: 'Sorties', value: counts.OUT, fill: TYPE_COLORS.OUT },
      {
        key: 'ADJUSTMENT' as const,
        label: 'Ajustements',
        value: counts.ADJUSTMENT,
        fill: TYPE_COLORS.ADJUSTMENT,
      },
    ];
  }, [filteredMovements]);

  const dailyActivity = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of filteredMovements) {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, count]) => ({
        date: date.slice(5),
        count,
      }));
  }, [filteredMovements]);

  const pieSlices = useMemo(
    () => typeStats.filter((t) => t.value > 0).map(({ label, value, fill }) => ({ name: label, value, fill })),
    [typeStats],
  );

  const canLoadMore = movementsSkip + movementsPageSize < movementsTotal;

  return (
    <section className="card stock-movements-panel">
      <div className="stock-movements-head">
        <div>
          <h2 className="stock-movements-title">Mouvements récents</h2>
          <p className="stock-movements-lead">
            {movementsTotal} mouvement{movementsTotal > 1 ? 's' : ''} au total ·{' '}
            {filteredMovements.length} affiché{filteredMovements.length > 1 ? 's' : ''}
            {stockQuery.trim() ? ' (filtre actif)' : ''}
          </p>
        </div>
        <div className="stock-movements-toolbar">
          <label className="stock-movements-search">
            Recherche
            <input
              value={stockQuery}
              onChange={(e) => onStockQueryChange(e.target.value)}
              placeholder="Produit, motif…"
            />
          </label>
          <label>
            Tri
            <select value={movementDateOrder} onChange={(e) => onOrderChange(e.target.value as 'asc' | 'desc')}>
              <option value="desc">Récent</option>
              <option value="asc">Ancien</option>
            </select>
          </label>
          <label>
            Lignes
            <select
              value={movementsPageSize}
              onChange={(e) => onPageSizeChange(e.target.value === '10' ? 10 : 5)}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading} onClick={onReset}>
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="stock-movements-stats">
        {typeStats.map((t) => (
          <div key={t.key} className={`stock-movements-stat stock-movements-stat--${t.key.toLowerCase()}`}>
            <span className="stock-movements-stat-label">{t.label}</span>
            <span className="stock-movements-stat-value">{t.value}</span>
          </div>
        ))}
      </div>

      {filteredMovements.length > 0 ? (
        <div className="stock-movements-charts">
          <div className="stock-movements-chart-card">
            <h3 className="stock-movements-chart-title">Activité (7 derniers jours affichés)</h3>
            <div className="stock-movements-chart-area">
              {dailyActivity.length === 0 ? (
                <p className="dept-hint">Pas assez de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyActivity} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip
                      formatter={(value: number) => [`${value} mvmt`, '']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="stock-movements-chart-card">
            <h3 className="stock-movements-chart-title">Répartition par type</h3>
            <div className="stock-movements-chart-area stock-movements-chart-area--pie">
              {pieSlices.length === 0 ? (
                <p className="dept-hint">Pas assez de données.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {pieSlices.map((slice) => (
                        <Cell key={slice.name} fill={slice.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="stock-movements-feed">
        {loading && movements.length === 0 ? (
          <p className="dept-hint">Chargement…</p>
        ) : filteredMovements.length === 0 ? (
          <p className="dept-hint">Aucun mouvement sur cette sélection.</p>
        ) : (
          filteredMovements.map((m) => (
            <article key={m.id} className={`stock-movement-row stock-movement-row--${m.type.toLowerCase()}`}>
              <div className="stock-movement-row-main">
                <span className="stock-movement-type">{movementTypeLabel(m.type)}</span>
                <strong className="stock-movement-product">{m.product?.name ?? `#${m.productId}`}</strong>
                <span className="stock-movement-meta">
                  {new Date(m.createdAt).toLocaleString()} · {formatUserLabel(m.createdBy)} ·{' '}
                  {movementReasonLabel(m.reason)}
                </span>
              </div>
              <div className="stock-movement-row-qty">
                <span className="stock-movement-qty">{formatQuantity(Number(m.quantity))}</span>
                <span className="stock-movement-unit">{stockPackagingLabelFromMovementProduct(m.product)}</span>
              </div>
            </article>
          ))
        )}
      </div>

      {movements.length > 0 ? (
        <p className="dept-hint stock-movements-foot">
          Chargées {movements.length} / {movementsTotal} · pas de {movementsPageSize} · tri{' '}
          {movementDateOrder === 'desc' ? 'récent → ancien' : 'ancien → récent'}.
        </p>
      ) : null}

      {canLoadMore ? (
        <div className="table-actions">
          <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={onLoadMore}>
            {loading ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
