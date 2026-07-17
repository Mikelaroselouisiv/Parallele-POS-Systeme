import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  cancelInventorySession,
  completeInventorySession,
  createInventorySession,
  exportInventoryCountSheetPdf,
  exportInventorySessionsPdf,
  getDepartments,
  getInventoryCountSheet,
  getInventorySession,
  listInventorySessions,
  patchInventoryLine,
} from '../services/api';
import type {
  CompanyListItem,
  InventoryCountSheet,
  InventorySessionDetail,
  InventorySessionKind,
  InventorySessionListItem,
} from '../types/api';
import { formatQuantity } from '../utils/formatQuantity';
import { formatUserLabel } from '../utils/userAttribution';

function formatApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    if (d && typeof d === 'object') {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join(', ');
    }
    if (typeof err.message === 'string' && err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

function kindLabel(k: InventorySessionKind | undefined): string {
  switch (k) {
    case 'OPENING':
      return 'Ouverture de période';
    case 'CLOSING':
      return 'Clôture de période';
    case 'AD_HOC':
      return 'Contrôle ponctuel';
    default:
      return 'Contrôle ponctuel';
  }
}

function kindHint(k: InventorySessionKind): string {
  switch (k) {
    case 'OPENING':
      return 'Comptage au début de la journée ou de la semaine, avant les ventes.';
    case 'CLOSING':
      return 'Comptage en fin de période pour clôturer la caisse et ajuster le stock.';
    default:
      return 'Inventaire hors ouverture/clôture (audit, contrôle surprise, etc.).';
  }
}

function referenceStockHint(kind: InventorySessionKind | undefined): string {
  return kind === 'CLOSING'
    ? 'Quantité enregistrée dans le système au moment où cette session a été ouverte.'
    : 'Quantité enregistrée dans le système au démarrage de ce comptage (référence pour l’écart).';
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Props = {
  companies: CompanyListItem[];
  visible: boolean;
  onStockChanged: () => void;
};

export function InventoryPhysicalSection({ companies, visible, onStockChanged }: Props) {
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [departments, setDepartments] = useState<Awaited<ReturnType<typeof getDepartments>>>([]);

  const [sheet, setSheet] = useState<InventoryCountSheet | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);

  const [sessions, setSessions] = useState<InventorySessionListItem[]>([]);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detail, setDetail] = useState<InventorySessionDetail | null>(null);

  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [sessionKind, setSessionKind] = useState<InventorySessionKind>('OPENING');

  useEffect(() => {
    if (companyId === '') {
      setDepartments([]);
      setDeptId('');
      return;
    }
    void getDepartments(companyId).then((d) => {
      setDepartments(d);
      setDeptId((prev) => (prev !== '' && d.some((x) => x.id === prev) ? prev : ''));
    });
  }, [companyId]);

  const loadSheet = useCallback(async () => {
    if (deptId === '') {
      setSheet(null);
      return;
    }
    setSheetLoading(true);
    setMsg('');
    try {
      setSheet(await getInventoryCountSheet(deptId));
    } catch (err) {
      setSheet(null);
      setMsg(formatApiError(err, 'Impossible de charger la feuille d’inventaire.'));
    } finally {
      setSheetLoading(false);
    }
  }, [deptId]);

  const loadSessions = useCallback(async () => {
    setMsg('');
    try {
      const list = await listInventorySessions({
        departmentId: deptId !== '' ? deptId : undefined,
        companyId: deptId === '' && companyId !== '' ? companyId : undefined,
      });
      setSessions(list);
    } catch (err) {
      setMsg(formatApiError(err, 'Chargement des sessions impossible.'));
    }
  }, [companyId, deptId]);

  useEffect(() => {
    if (!visible) return;
    void loadSheet();
    void loadSessions();
  }, [visible, loadSheet, loadSessions]);

  const draftSessions = useMemo(
    () => sessions.filter((s) => s.status === 'DRAFT'),
    [sessions],
  );

  const countedProgress = useMemo(() => {
    if (!detail || detail.status !== 'DRAFT') return null;
    const total = detail.lines.length;
    const done = detail.lines.filter((l) => l.countedQty != null).length;
    return { done, total };
  }, [detail]);

  async function openSession(id: number) {
    setMsg('');
    setBusy(true);
    try {
      setDetail(await getInventorySession(id));
      setView('detail');
    } catch (err) {
      setMsg(formatApiError(err, 'Session introuvable.'));
    } finally {
      setBusy(false);
    }
  }

  async function startCountSession() {
    if (deptId === '') {
      setMsg('Choisissez un département pour démarrer un comptage.');
      return;
    }
    const existing = draftSessions.find((s) => s.departmentId === deptId);
    if (existing) {
      if (!confirm(`Un comptage est déjà ouvert pour ce département (#${existing.id}). L’ouvrir ?`)) {
        return;
      }
      await openSession(existing.id);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const s = await createInventorySession({ departmentId: deptId, kind: sessionKind });
      setDetail(s);
      setView('detail');
      await loadSessions();
      setMsg(`Session « ${kindLabel(sessionKind)} » ouverte. Saisissez les quantités comptées.`);
    } catch (err) {
      setMsg(formatApiError(err, 'Impossible d’ouvrir une session.'));
    } finally {
      setBusy(false);
    }
  }

  async function onExportSheet() {
    if (deptId === '') {
      setMsg('Choisissez un département pour exporter la feuille.');
      return;
    }
    setExportingSheet(true);
    setMsg('');
    try {
      const blob = await exportInventoryCountSheetPdf(deptId);
      const co = companies.find((c) => c.id === companyId)?.name ?? 'entreprise';
      const dept = departments.find((d) => d.id === deptId)?.name ?? 'dept';
      const safe = `${co}_${dept}`.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 50);
      downloadBlob(blob, `feuille_inventaire_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setMsg('Feuille d’inventaire exportée (PDF).');
    } catch (err) {
      setMsg(formatApiError(err, 'Export PDF impossible.'));
    } finally {
      setExportingSheet(false);
    }
  }

  async function onExportHistory() {
    setExportingHistory(true);
    setMsg('');
    try {
      const blob = await exportInventorySessionsPdf({
        departmentId: deptId !== '' ? deptId : undefined,
        companyId: deptId === '' && companyId !== '' ? companyId : undefined,
      });
      downloadBlob(blob, `historique_inventaires_${new Date().toISOString().slice(0, 10)}.pdf`);
      setMsg('Historique exporté (PDF).');
    } catch (err) {
      setMsg(formatApiError(err, 'Export historique impossible.'));
    } finally {
      setExportingHistory(false);
    }
  }

  async function saveLine(lineId: number, countedRaw: string) {
    if (!detail) return;
    const trimmed = countedRaw.trim();
    const countedQty = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (countedQty !== null && (!Number.isFinite(countedQty) || countedQty < 0)) {
      setMsg('Quantité comptée invalide.');
      return;
    }
    setMsg('');
    try {
      await patchInventoryLine(detail.id, lineId, { countedQty });
      setDetail(await getInventorySession(detail.id));
    } catch (err) {
      setMsg(formatApiError(err, 'Enregistrement impossible.'));
    }
  }

  async function onComplete() {
    if (!detail) return;
    if (
      !confirm(
        detail.kind === 'CLOSING'
          ? 'Valider l’inventaire de clôture ?\n\nLe stock sera ajusté pour correspondre aux quantités comptées.'
          : detail.kind === 'OPENING'
            ? 'Valider l’inventaire d’ouverture ?\n\nLe stock sera ajusté si vos comptages diffèrent de la référence système.'
            : 'Valider l’inventaire ?\n\nLe stock de chaque produit compté sera ajusté pour correspondre à la quantité saisie.',
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      setDetail(await completeInventorySession(detail.id));
      await loadSessions();
      await loadSheet();
      onStockChanged();
      setMsg('Inventaire validé — stocks mis à jour.');
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
            ← Retour
          </button>
          <span className="info-text" style={{ margin: 0 }}>
            {detail.department.company.name} — {detail.department.name} · {kindLabel(detail.kind)} ·{' '}
            {statusLabel(detail.status)}
            {detail.label ? ` · ${detail.label}` : ''}
          </span>
        </div>

        {countedProgress ? (
          <p className="dept-hint" style={{ margin: '0 0 0.75rem' }}>
            Progression : {countedProgress.done} / {countedProgress.total} produit(s) compté(s)
          </p>
        ) : null}

        {msg ? (
          <p className={/validé|exporté|exportée|ouverte|mis à jour/i.test(msg) ? 'info-text' : 'error-text'}>
            {msg}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th title={referenceStockHint(detail.kind)}>Stock enregistré</th>
                {readOnly ? <th title="Stock système après validation">Stock final</th> : null}
                <th>Compté</th>
                <th>Écart</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 4}>Aucun produit avec stock suivi dans ce département.</td>
                </tr>
              ) : (
                detail.lines.map((line) => {
                  const open = Number(line.systemQtyAtOpen);
                  const current = Number(line.product.stock ?? 0);
                  const counted = line.countedQty != null ? Number(line.countedQty) : null;
                  const variance = counted != null ? counted - open : null;
                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.product.name}</strong>
                        {line.product.sku ? <small> · {line.product.sku}</small> : null}
                      </td>
                      <td className="journal-amt">{formatQuantity(open)}</td>
                      {readOnly ? <td className="journal-amt">{formatQuantity(current)}</td> : null}
                      <td style={{ maxWidth: '8rem' }}>
                        {readOnly ? (
                          counted != null ? (
                            <span className="journal-amt">{formatQuantity(counted)}</span>
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
                      <td className="journal-amt">
                        {variance != null ? (
                          <span style={{ color: variance === 0 ? '#64748b' : variance > 0 ? '#059669' : '#dc2626' }}>
                            {variance > 0 ? '+' : ''}
                            {formatQuantity(variance)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
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
              Valider et ajuster les stocks
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void onCancelSession()}>
              Annuler la session
            </button>
          </div>
        ) : detail.completedAt ? (
          <p className="dept-hint" style={{ marginTop: '1rem' }}>
            Clôturé le {new Date(detail.completedAt).toLocaleString('fr-FR')}
            {detail.completedBy ? ` · par ${formatUserLabel(detail.completedBy)}` : ''}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2>Inventaire physique</h2>

        <div className="form-grid" style={{ maxWidth: '36rem', marginBottom: '1rem' }}>
          <label>
            Entreprise
            <select
              value={companyId === '' ? '' : String(companyId)}
              onChange={(e) => {
                const v = e.target.value;
                setCompanyId(v ? Number(v) : '');
                setDeptId('');
              }}
            >
              <option value="">— Choisir</option>
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
              value={deptId === '' ? '' : String(deptId)}
              onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : '')}
              disabled={companyId === ''}
            >
              <option value="">
                {companyId === '' ? '— Choisir une entreprise d’abord —' : '— Choisir —'}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {msg ? (
          <p className={/validé|exporté|exportée|ouverte|mis à jour/i.test(msg) ? 'info-text' : 'error-text'}>
            {msg}
          </p>
        ) : null}

        {deptId === '' ? null : sheetLoading ? (
          <p className="info-text">Chargement de la feuille…</p>
        ) : sheet ? (
          <>
            <fieldset
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '0.75rem',
                maxWidth: '42rem',
              }}
            >
              <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>Type de comptage</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(['OPENING', 'CLOSING', 'AD_HOC'] as const).map((k) => (
                  <label key={k} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sessionKind"
                      value={k}
                      checked={sessionKind === k}
                      onChange={() => setSessionKind(k)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <span>
                      <strong>{kindLabel(k)}</strong>
                      <br />
                      <small className="dept-hint">{kindHint(k)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={exportingSheet || sheet.products.length === 0}
                onClick={() => void onExportSheet()}
              >
                {exportingSheet ? 'Export…' : 'Exporter la feuille (PDF)'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || sheet.products.length === 0}
                onClick={() => void startCountSession()}
              >
                Démarrer le comptage
              </button>
              <span className="dept-hint" style={{ margin: 0 }}>
                {sheet.products.length} produit(s) · généré{' '}
                {new Date(sheet.generatedAt).toLocaleString('fr-FR')}
              </span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produit</th>
                    <th>SKU</th>
                    <th>Unité</th>
                    <th>Stock système</th>
                    <th>Compté (terrain)</th>
                    <th>Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.products.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Aucun produit avec stock suivi dans ce département.</td>
                    </tr>
                  ) : (
                    sheet.products.map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{p.name}</strong>
                        </td>
                        <td>{p.sku ?? '—'}</td>
                        <td>
                          <small>{p.unitLabel}</small>
                        </td>
                        <td className="journal-amt">{formatQuantity(p.stock)}</td>
                        <td className="journal-amt" style={{ color: '#94a3b8' }}>
                          —
                        </td>
                        <td className="journal-amt" style={{ color: '#94a3b8' }}>
                          —
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ margin: 0 }}>Historique des comptages</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={exportingHistory || (companyId === '' && deptId === '')}
            onClick={() => void onExportHistory()}
          >
            {exportingHistory ? 'Export…' : 'Exporter l’historique (PDF)'}
          </button>
        </div>

        {draftSessions.length > 0 ? (
          <p className="info-text">
            {draftSessions.length} comptage(s) en cours
            {deptId !== '' ? ' pour ce département' : ''}.
            {draftSessions.slice(0, 3).map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: '0.35rem' }}
                onClick={() => void openSession(s.id)}
              >
                Reprendre #{s.id}
              </button>
            ))}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Entreprise — Département</th>
                <th>Libellé</th>
                <th>Statut</th>
                <th>Par</th>
                <th>Lignes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {companyId === '' && deptId === ''
                      ? 'Choisissez une entreprise ou un département pour voir l’historique.'
                      : 'Aucune session pour ce filtre.'}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.createdAt).toLocaleString('fr-FR')}</td>
                    <td>{kindLabel(s.kind)}</td>
                    <td>
                      {s.department.company.name} — {s.department.name}
                    </td>
                    <td>{s.label ?? '—'}</td>
                    <td>{statusLabel(s.status)}</td>
                    <td>{formatUserLabel(s.createdBy)}</td>
                    <td>{s._count.lines}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void openSession(s.id)}
                      >
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
    </>
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
