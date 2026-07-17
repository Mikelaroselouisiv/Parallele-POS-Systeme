import { useState } from 'react';

import { exportDashboardSalesByProductPdf } from '../services/api';
import type { DashboardSalesByProductRow } from '../types/api';
import { formatMoney } from '../utils/currency';
import { formatQuantity } from '../utils/formatQuantity';

type Props = {
  label: string;
  departmentId: number | null;
  rows: DashboardSalesByProductRow[];
  dateFrom: string;
  dateTo: string;
  companyId: number;
  onClose: () => void;
  onMessage: (msg: string, opts?: { persist?: boolean }) => void;
};

export function VentesDepartmentModal({
  label,
  departmentId,
  rows,
  dateFrom,
  dateTo,
  companyId,
  onClose,
  onMessage,
}: Props) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const deptTotal = rows.reduce((s, r) => s + r.totalSubtotal, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

  async function exportPdf() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      onMessage('Indiquez une plage de dates valide (du … au …).', { persist: true });
      return;
    }
    if (departmentId == null) {
      onMessage('Export PDF indisponible pour les lignes sans département.', { persist: true });
      return;
    }
    setPdfLoading(true);
    onMessage('');
    try {
      const blob = await exportDashboardSalesByProductPdf({
        companyId,
        dateFrom,
        dateTo,
        departmentId,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = label.replace(/[^\w\-]+/g, '_').slice(0, 40);
      a.download = `ventes-${slug}_${dateFrom}_${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onMessage("Impossible d'exporter le PDF.", { persist: true });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card modal-purchasing ventes-dept-modal"
        role="dialog"
        aria-modal
        aria-labelledby="ventes-dept-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading ventes-dept-modal-head">
          <div>
            <h2 id="ventes-dept-modal-title" style={{ margin: 0 }}>
              {label}
            </h2>
            <p className="dept-hint" style={{ margin: '0.25rem 0 0' }}>
              {dateFrom} → {dateTo} · {rows.length} article{rows.length > 1 ? 's' : ''} ·{' '}
              {formatMoney(deptTotal)}
            </p>
          </div>
          <div className="ventes-dept-modal-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pdfLoading || departmentId == null}
              onClick={() => void exportPdf()}
            >
              {pdfLoading ? 'Export PDF…' : 'Exporter PDF'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="ventes-dept-modal-summary">
          <span>
            <strong>{rows.length}</strong> ligne{rows.length > 1 ? 's' : ''}
          </span>
          <span>
            Qté totale <strong>{formatQuantity(totalQty)}</strong>
          </span>
          <span>
            Total <strong>{formatMoney(deptTotal)}</strong>
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit / service</th>
                <th>Type</th>
                <th className="journal-amt">Qté (base)</th>
                <th className="journal-amt">Total vendu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td>{r.productName}</td>
                  <td>{r.isService ? 'Service' : 'Produit'}</td>
                  <td className="journal-amt">{formatQuantity(r.quantity)}</td>
                  <td className="journal-amt">{formatMoney(r.totalSubtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>
                  <strong>Sous-total {label}</strong>
                </td>
                <td className="journal-amt">
                  <strong>{formatMoney(deptTotal)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
