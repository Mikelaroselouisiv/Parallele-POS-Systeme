import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import {
  cancelInventorySession,
  completeInventorySession,
  createInventorySession,
  exportInventorySessionsPdf,
  getInventorySession,
  listInventorySessions,
  patchInventoryLine,
} from '../services/api';
import type {
  Department,
  InventorySessionDetail,
  InventorySessionListItem,
} from '../types/api';

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

function statusLabel(s: InventorySessionListItem['status']): string {
  switch (s) {
    case 'DRAFT':
      return 'Brouillon';
    case 'COMPLETED':
      return 'Validé';
    case 'CANCELLED':
      return 'Annulé';
    default:
      return s;
  }
}

type Props = {
  departments: Department[];
  visible: boolean;
  onStockChanged: () => void;
};

export function InventoryPhysicalSection({ departments, visible, onStockChanged }: Props) {
  const [sessions, setSessions] = useState<InventorySessionListItem[]>([]);
  const [filterDeptId, setFilterDeptId] = useState<number | ''>('');
  const [createDeptId, setCreateDeptId] = useState<number | ''>('');
  const [createLabel, setCreateLabel] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detail, setDetail] = useState<InventorySessionDetail | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadSessions = useCallback(async () => {
    setMsg('');
    try {
      const list = await listInventorySessions(
        filterDeptId === '' ? undefined : filterDeptId,
      );
      setSessions(list);
    } catch (err) {
      setMsg(formatApiError(err, 'Chargement impossible.'));
    }
  }, [filterDeptId]);

  useEffect(() => {
    if (!visible) return;
    void loadSessions();
  }, [visible, loadSessions]);

  useEffect(() => {
    if (departments.length && createDeptId === '') {
      setCreateDeptId(departments[0].id);
    }
  }, [departments, createDeptId]);

  async function openSession(id: number) {
    setMsg('');
    setBusy(true);
    try {
      const s = await getInventorySession(id);
      setDetail(s);
      setView('detail');
    } catch (err) {
      setMsg(formatApiError(err, 'Session introuvable.'));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (createDeptId === '') {
      setMsg('Choisissez un département.');
      return;
    }
    setBusy(true);
    try {
      const s = await createInventorySession({
        departmentId: createDeptId,
        label: createLabel.trim() || undefined,
        note: createNote.trim() || undefined,
      });
      setDetail(s);
      setView('detail');
      setCreateLabel('');
      setCreateNote('');
      await loadSessions();
    } catch (err) {
      setMsg(formatApiError(err, 'Création impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveLine(lineId: number, countedRaw: string) {
    if (!detail) return;
    const trimmed = countedRaw.trim();
    const countedQty =
      trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (countedQty !== null && (!Number.isFinite(countedQty) || countedQty < 0)) {
      setMsg('Quantité comptée invalide.');
      return;
    }
    setMsg('');
    try {
      await patchInventoryLine(detail.id, lineId, { countedQty });
      const next = await getInventorySession(detail.id);
      setDetail(next);
    } catch (err) {
      setMsg(formatApiError(err, 'Enregistrement impossible.'));
    }
  }

  async function onComplete() {
    if (!detail) return;
    if (!confirm('Valider l’inventaire ? Les stocks seront ajustés pour égaler les quantités comptées.')) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const next = await completeInventorySession(detail.id);
      setDetail(next);
      await loadSessions();
      onStockChanged();
      setMsg('Inventaire validé. Les stocks ont été mis à jour.');
    } catch (err) {
      setMsg(formatApiError(err, 'Validation impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function onCancelSession() {
    if (!detail) return;
    if (!confirm('Annuler cette session ? Aucun stock ne sera modifié.')) return;
    setBusy(true);
    setMsg('');
    try {
      await cancelInventorySession(detail.id);
      setView('list');
      setDetail(null);
      await loadSessions();
    } catch (err) {
      setMsg(formatApiError(err, 'Annulation impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function onExportPdf() {
    setMsg('');
    if (exportingPdf || busy) return;
    setExportingPdf(true);
    try {
      const blob = await exportInventorySessionsPdf({
        departmentId: filterDeptId === '' ? undefined : filterDeptId,
        take: 80,
      });

      const selectedDept =
        filterDeptId === '' ? null : departments.find((d) => d.id === filterDeptId) ?? null;
      const deptSlug = selectedDept
        ? `${selectedDept.company?.name ?? ''}${selectedDept.company?.name ? ' - ' : ''}${selectedDept.name}`
        : 'Tous';
      const safe = deptSlug.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 60);
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `inventaires_${safe}_${date}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setMsg('Export PDF lancé (téléchargement).');
    } catch (err) {
      setMsg(formatApiError(err, 'Export PDF impossible.'));
    } finally {
      setExportingPdf(false);
    }
  }

  if (!visible) return null;

  if (view === 'detail' && detail) {
    const readOnly = detail.status !== 'DRAFT';
    return (
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => {
              setView('list');
              setDetail(null);
              void loadSessions();
            }}
          >
            ← Liste des inventaires
          </button>
          <span className="info-text" style={{ margin: 0, padding: '0.35rem 0.75rem' }}>
            {detail.department.company.name} — {detail.department.name} · {statusLabel(detail.status)}
            {detail.label ? ` · ${detail.label}` : ''}
          </span>
        </div>
        {detail.note ? <p className="dept-hint">{detail.note}</p> : null}
        {msg ? <p className={msg.includes('validé') || msg.includes('mis à jour') ? 'info-text' : 'error-text'}>{msg}</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>À l’ouverture</th>
                <th>Stock actuel</th>
                <th>Compté</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    Aucun article à inventorier dans ce département (produits avec stock suivi uniquement).
                  </td>
                </tr>
              ) : (
                detail.lines.map((line) => {
                  const current = Number(line.product.stock ?? 0);
                  const open = Number(line.systemQtyAtOpen);
                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.product.name}</strong>
                        {line.product.sku ? <small> · {line.product.sku}</small> : null}
                      </td>
                      <td className="journal-amt">{open.toFixed(3)}</td>
                      <td className="journal-amt">{current.toFixed(3)}</td>
                      <td style={{ maxWidth: '8rem' }}>
                        {readOnly ? (
                          line.countedQty != null ? (
                            <span className="journal-amt">{Number(line.countedQty).toFixed(3)}</span>
                          ) : (
                            '—'
                          )
                        ) : (
                          <LineCountInput
                            lineId={line.id}
                            initial={line.countedQty != null ? String(line.countedQty) : ''}
                            onSave={(raw) => void saveLine(line.id, raw)}
                          />
                        )}
                      </td>
                      <td />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!readOnly ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onComplete()}>
              Valider l’inventaire (ajuster les stocks)
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onCancelSession()}>
              Annuler la session
            </button>
          </div>
        ) : detail.completedAt ? (
          <p className="dept-hint" style={{ marginTop: '1rem' }}>
            Clôturé le {new Date(detail.completedAt).toLocaleString()}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Inventaire physique</h2>
      
      {msg ? <p className="error-text">{msg}</p> : null}

      <div className="form-grid" style={{ maxWidth: '28rem', marginBottom: '1rem' }}>
        <label>
          Filtrer par département
          <select
            value={filterDeptId === '' ? '' : String(filterDeptId)}
            onChange={(e) => setFilterDeptId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Tous</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.company ? `${d.company.name} — ${d.name}` : d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || exportingPdf}
          onClick={() => void onExportPdf()}
        >
          {exportingPdf ? 'Export PDF…' : 'Exporter PDF'}
        </button>
        {msg ? (
          <span className={/téléchargement|Export PDF lancé/i.test(msg) ? 'info-text' : 'error-text'}>{msg}</span>
        ) : null}
      </div>

      <h3 className="dept-list-title" style={{ marginTop: 0 }}>
        Nouvelle session
      </h3>
      <form className="form-grid" style={{ maxWidth: '32rem' }} onSubmit={(e) => void onCreate(e)}>
        <label>
          Département *
          <select
            value={createDeptId === '' ? '' : String(createDeptId)}
            onChange={(e) => setCreateDeptId(e.target.value ? Number(e.target.value) : '')}
            required
          >
            <option value="">— Choisir</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.company ? `${d.company.name} — ${d.name}` : d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Libellé (optionnel)
          <input value={createLabel} onChange={(e) => setCreateLabel(e.target.value)} placeholder="Ex. Inventaire mars 2025" />
        </label>
        <label>
          Note (optionnel)
          <input value={createNote} onChange={(e) => setCreateNote(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || departments.length === 0}>
          Ouvrir une session
        </button>
      </form>

      <h3 className="dept-list-title" style={{ marginTop: '1.5rem' }}>
        Sessions récentes
      </h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Département</th>
              <th>Statut</th>
              <th>Lignes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5}>Aucune session. Créez-en une ci-dessus.</td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    {s.department.company.name} — {s.department.name}
                  </td>
                  <td>{statusLabel(s.status)}</td>
                  <td>{s._count.lines}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void openSession(s.id)}>
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LineCountInput({
  lineId,
  initial,
  onSave,
}: {
  lineId: number;
  initial: string;
  onSave: (raw: string) => void;
}) {
  const [v, setV] = useState(initial);

  useEffect(() => {
    setV(initial);
  }, [lineId, initial]);

  return (
    <input
      type="number"
      min={0}
      step="any"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim() === initial.trim()) return;
        onSave(v);
      }}
      placeholder="Qté"
    />
  );
}
