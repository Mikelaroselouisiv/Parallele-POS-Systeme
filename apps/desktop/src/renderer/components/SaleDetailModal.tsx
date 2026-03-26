import axios from 'axios';
import { useState } from 'react';
import type { CompanyProfile, DepartmentPrinterSettings, Sale } from '../types/api';
import { exportSalePdf } from '../services/api';
import { buildReceiptPayloadFromSale } from '../utils/receiptPayload';
import { buildSaleDetailPrintHtml, openBrowserPrintWindow } from '../utils/saleReceiptBrowserHtml';

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

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Espèces';
    case 'CARD':
      return 'Carte';
    case 'MOBILE_MONEY':
      return 'Mobile money';
    case 'SPLIT':
      return 'Mixte';
    default:
      return method;
  }
}

export function SaleDetailModal({
  sale,
  companyName,
  company,
  printer,
  onClose,
}: {
  sale: Sale | null;
  companyName?: string;
  company: CompanyProfile | null;
  printer: DepartmentPrinterSettings | null;
  onClose: () => void;
}) {
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);

  if (!sale) return null;

  const hasElectronPrint = typeof window.desktopApp?.printReceipt === 'function';

  async function printThermalReceipt() {
    if (!sale) return;
    setReceiptMsg(null);
    setReceiptBusy(true);
    try {
      if (hasElectronPrint) {
        const payload = buildReceiptPayloadFromSale(sale, company, printer);
        const r = await window.desktopApp!.printReceipt!(payload);
        if (!r.ok) {
          setReceiptMsg(r.reason || "L'impression n'a pas pu aboutir.");
        }
      } else {
        const html = buildSaleDetailPrintHtml(sale, companyName);
        openBrowserPrintWindow(html);
      }
    } catch {
      setReceiptMsg('Erreur lors de l’impression.');
    } finally {
      setReceiptBusy(false);
    }
  }

  async function exportPdf() {
    if (!sale) return;
    setReceiptMsg(null);
    setReceiptBusy(true);
    try {
      const blob = await exportSalePdf(sale.id);
      const fileName = `ticket-vente-${sale.id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setReceiptMsg('Export PDF lancé (téléchargement).');
    } catch (err) {
      setReceiptMsg(formatApiError(err, 'Export PDF impossible.'));
    } finally {
      setReceiptBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal
        aria-labelledby="sale-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%' }}
      >
        <div className="modal-heading">
          <h2 id="sale-detail-title">Vente #{sale.id}</h2>
          <p className="dept-hint" style={{ margin: 0 }}>
            {new Date(sale.createdAt).toLocaleString()}
            {companyName ? ` · ${companyName}` : ''}
          </p>
        </div>

        <div className="form-grid" style={{ gap: '0.5rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Client</strong> : {(sale.clientName && sale.clientName.trim()) || '—'}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Caissier</strong> :{' '}
            {sale.user?.fullName?.trim() || sale.cashier || sale.user?.phone || '—'}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Statut</strong> : {sale.status}
          </p>
        </div>

        <div className="table-wrap" style={{ maxHeight: 280, marginTop: '0.75rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items ?? []).map((it, idx) => (
                <tr key={idx}>
                  <td>{it.lineLabel ?? it.product?.name ?? '—'}</td>
                  <td>{Number(it.quantity).toFixed(3)}</td>
                  <td>{Number(it.unitPrice).toFixed(2)}</td>
                  <td>{Number(it.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ margin: '0.75rem 0 0', fontWeight: 800 }}>
          Total : {Number(sale.total).toFixed(2)}
        </p>

        {sale.payments && sale.payments.length > 0 ? (
          <>
            <h3 style={{ margin: '1rem 0 0.35rem', fontSize: '0.95rem' }}>Paiements</h3>
            <ul className="simple-list" style={{ marginTop: 0 }}>
              {sale.payments.map((p, i) => (
                <li key={p.id ?? i} className="simple-list-row">
                  <span>{paymentMethodLabel(String(p.method))}</span>
                  <span>{Number(p.amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="dept-hint" style={{ marginTop: '0.75rem' }}>
          {hasElectronPrint
            ? 'Impression : même ticket que sur la caisse (thermique ou secours). '
            : 'Impression : aperçu navigateur. '}
          PDF : généré par le serveur (comme l’export inventaires), fichier téléchargé — pas d’impression.
        </p>

        {receiptMsg ? (
          <p className="info-text" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {receiptMsg}
          </p>
        ) : null}

        <div
          className="modal-actions"
          style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={receiptBusy}>
            Fermer
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void printThermalReceipt()}
            disabled={receiptBusy}
          >
            {receiptBusy ? 'Patientez…' : 'Imprimer (ticket caisse)'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void exportPdf()}
            disabled={receiptBusy}
          >
            {receiptBusy ? 'Patientez…' : 'Exporter en PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
