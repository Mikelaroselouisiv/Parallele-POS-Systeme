import type { DashboardBalanceSnapshot } from '../types/api';
import { formatMoney } from '../utils/currency';

type Props = {
  snapshot: DashboardBalanceSnapshot;
  periodLabel: string;
};

function trendHint(snapshot: DashboardBalanceSnapshot): string | null {
  if (snapshot.trendPct == null) return null;
  const sign = snapshot.trendPct > 0 ? '+' : '';
  const arrow = snapshot.trend === 'UP' ? '↑' : snapshot.trend === 'DOWN' ? '↓' : '→';
  return `${arrow} ${sign}${snapshot.trendPct.toFixed(1)} % vs période précédente`;
}

export function DashboardKpiStrip({ snapshot, periodLabel }: Props) {
  const trend = trendHint(snapshot);

  return (
    <section className="card" style={{ marginTop: '1rem' }}>
      <h2 style={{ marginBottom: '0.65rem' }}>Indicateurs · {periodLabel}</h2>
      <div className="grid synthese-kpi-grid" style={{ marginBottom: 0 }}>
        <div className="card synthese-kpi synthese-kpi--sales">
          <div className="synthese-kpi-label">Chiffre d&apos;affaires</div>
          <div className="synthese-kpi-value">{formatMoney(snapshot.sales)}</div>
        </div>
        <div className="card synthese-kpi synthese-kpi--out">
          <div className="synthese-kpi-label">Total sorties</div>
          <div className="synthese-kpi-value">{formatMoney(snapshot.totalOutflows)}</div>
          <div className="synthese-kpi-sub">
            Achats {formatMoney(snapshot.purchases)} · Dép. {formatMoney(snapshot.manualExpenses)}
          </div>
        </div>
        <div className="card synthese-kpi synthese-kpi--result">
          <div className="synthese-kpi-label">Résultat net</div>
          <div
            className="synthese-kpi-value"
            style={{ color: snapshot.balance < 0 ? '#dc2626' : '#0f172a' }}
          >
            {formatMoney(snapshot.balance)}
          </div>
          {trend ? <div className="synthese-kpi-sub">{trend}</div> : null}
        </div>
      </div>
    </section>
  );
}
