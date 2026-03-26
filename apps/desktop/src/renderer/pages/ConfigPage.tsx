import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  type CompanyCreatePayload,
  createCompany,
  createDepartment,
  createPackagingUnit,
  createUser,
  deleteCompany,
  deleteDepartment,
  deletePackagingUnit,
  deleteUser,
  getCompanies,
  getDepartments,
  getPackagingUnits,
  getPrinterSettings,
  getProducts,
  getUsers,
  patchPrinterSettings,
  updateCompany,
  updateDepartment,
  updatePackagingUnit,
  updateUser,
} from '../services/api';
import { buildTicketPreviewText } from '../utils/ticketPreview';
import { PasswordField } from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import {
  type AutoClearMessageOptions,
  useAutoClearMessage,
} from '../hooks/useAutoClearMessage';
import type {
  CompanyListItem,
  Department,
  DepartmentPrinterSettings,
  PackagingUnit,
  Product,
  SessionUser,
} from '../types/api';
import axios from 'axios';

function formatApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (typeof d === 'string' && d.trim()) return d;
    if (d && typeof d === 'object') {
      const m = (d as { message?: unknown; error?: unknown }).message;
      if (typeof m === 'string') return m;
      if (Array.isArray(m)) return m.join(', ');
      const e = (d as { error?: unknown }).error;
      if (typeof e === 'string') return e;
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Pas de réponse du serveur (réseau ou API arrêtée).';
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

type Tab = 'company' | 'printer' | 'packaging' | 'users';

const ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT'] as const;

export function ConfigPage() {
  const { can } = useAuth();
  const isAdmin = can(['ADMIN']);
  const [tab, setTab] = useState<Tab>('company');
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [msg, setMsg] = useAutoClearMessage();

  const [printerCompanyId, setPrinterCompanyId] = useState<number | ''>('');
  const [printerDepartmentId, setPrinterDepartmentId] = useState<number | ''>('');
  const [printerForm, setPrinterForm] = useState<DepartmentPrinterSettings | null>(null);
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printersList, setPrintersList] = useState<Array<{ name: string }>>([]);

  const load = async () => {
    const [co, d] = await Promise.all([getCompanies(), getDepartments()]);
    setCompanies(co);
    setDepartments(d);
    if (isAdmin) {
      setUsers(await getUsers());
    }
  };

  useEffect(() => {
    void load().catch(() => setMsg('Erreur chargement configuration', { persist: true }));
  }, [isAdmin]);

  useEffect(() => {
    if (printerDepartmentId === '') {
      setPrinterForm(null);
      return;
    }
    setPrinterLoading(true);
    void getPrinterSettings(printerDepartmentId)
      .then((p) => {
        if (!p) {
          setPrinterForm(null);
          return;
        }
        setPrinterForm({
          ...p,
          paperWidth: p.paperWidth === 80 ? 80 : 58,
          deviceName: p.deviceName ?? '',
        });
      })
      .catch((err: unknown) => {
        setPrinterForm(null);
        let detail = 'Vérifiez que le serveur API tourne et que vous êtes connecté.';
        if (axios.isAxiosError(err)) {
          if (err.code === 'ERR_NETWORK') {
            detail = 'Pas de réponse du serveur (API arrêtée ou mauvaise adresse).';
          } else if (err.response?.status === 401) {
            detail = 'Session expirée : reconnectez-vous.';
          } else if (err.response?.status === 404) {
            detail = 'Département introuvable côté serveur.';
          } else if (err.response?.data && typeof err.response.data === 'object') {
            const m = (err.response.data as { message?: unknown }).message;
            if (typeof m === 'string') detail = m;
            else if (Array.isArray(m)) detail = m.join(', ');
          }
        }
        setMsg(`Impossible de charger le profil imprimante. ${detail}`, { persist: true });
      })
      .finally(() => setPrinterLoading(false));
  }, [printerDepartmentId]);

  useEffect(() => {
    if (tab !== 'printer') return;
    void window.desktopApp?.listPrinters?.()?.then(setPrintersList).catch(() => setPrintersList([]));
  }, [tab]);

  const printerDepts = useMemo(
    () =>
      printerCompanyId === ''
        ? []
        : departments.filter((d) => d.companyId === printerCompanyId),
    [departments, printerCompanyId],
  );

  const selectedPrinterCompany = useMemo(
    () => (printerCompanyId === '' ? undefined : companies.find((c) => c.id === printerCompanyId)),
    [companies, printerCompanyId],
  );

  const ticketPreviewText = useMemo(() => {
    if (!printerForm || !selectedPrinterCompany) return '';
    const addr = [selectedPrinterCompany.address, selectedPrinterCompany.city]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');
    return buildTicketPreviewText({
      paperWidth: printerForm.paperWidth === 80 ? 80 : 58,
      companyName: selectedPrinterCompany.name,
      companyPhone: selectedPrinterCompany.phone ?? null,
      address: addr,
      receiptHeaderText: printerForm.receiptHeaderText,
      receiptFooterText: printerForm.receiptFooterText,
      showLogoOnReceipt: printerForm.showLogoOnReceipt,
      receiptLogoUrl: printerForm.receiptLogoUrl,
      cashier: 'Test caisse',
      isTest: true,
      previewSampleBody:
        (printerForm.previewSampleBody || '').trim() ||
        'Article exemple A  x2\nArticle exemple B  x1',
      total: 1250.5,
      paymentMode: 'TEST',
    });
  }, [printerForm, selectedPrinterCompany]);

  async function savePrinter(e: FormEvent) {
    e.preventDefault();
    if (!printerForm || printerDepartmentId === '') return;
    setMsg('');
    try {
      const updated = await patchPrinterSettings({
        departmentId: printerDepartmentId,
        paperWidth: printerForm.paperWidth,
        deviceName: printerForm.deviceName,
        autoCut: printerForm.autoCut,
        showLogoOnReceipt: printerForm.showLogoOnReceipt,
        receiptHeaderText: printerForm.receiptHeaderText ?? undefined,
        receiptFooterText: printerForm.receiptFooterText ?? undefined,
        receiptLogoUrl: printerForm.receiptLogoUrl ?? '',
        previewSampleBody: printerForm.previewSampleBody ?? undefined,
      });
      setPrinterForm({
        ...updated,
        paperWidth: updated.paperWidth === 80 ? 80 : 58,
        deviceName: updated.deviceName ?? '',
      });
      setMsg('Profil imprimante enregistré pour ce département.');
    } catch {
      setMsg('Échec enregistrement imprimante.', { persist: true });
    }
  }

  async function printTestTicket() {
    if (!printerForm || !selectedPrinterCompany || printerDepartmentId === '') {
      setMsg('Choisissez une entreprise et un département.', { persist: true });
      return;
    }
    if (!window.desktopApp?.printReceipt) {
      setMsg('Impression disponible uniquement dans l’application bureau (Electron).', {
        persist: true,
      });
      return;
    }
    setMsg('');
    const addr = [selectedPrinterCompany.address, selectedPrinterCompany.city]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');
    const sample =
      (printerForm.previewSampleBody || '').trim() ||
      'Article exemple A  x2\nArticle exemple B  x1';
    try {
      const r = await window.desktopApp.printReceipt({
        companyName: selectedPrinterCompany.name,
        companyPhone: selectedPrinterCompany.phone ?? null,
        address: addr,
        cashier: 'Test',
        items: [],
        total: 1250.5,
        paymentMode: 'TEST',
        paperWidth: printerForm.paperWidth === 80 ? 80 : 58,
        printerName: printerForm.deviceName || undefined,
        receiptHeaderText: printerForm.receiptHeaderText ?? null,
        receiptFooterText: printerForm.receiptFooterText ?? null,
        receiptLogoUrl: printerForm.receiptLogoUrl ?? null,
        showLogoOnReceipt: printerForm.showLogoOnReceipt,
        autoCut: printerForm.autoCut,
        isTest: true,
        previewSampleBody: sample,
      });
      if (r.ok) {
        setMsg(
          r.mode === 'escpos'
            ? 'Test envoyé à l’imprimante thermique.'
            : 'Test envoyé via la file d’impression Windows.',
        );
      } else {
        setMsg(r.reason || 'Échec impression test.', { persist: true });
      }
    } catch {
      setMsg('Échec impression test.', { persist: true });
    }
  }

  return (
    <div className="page-inner">
      <header className="page-header">
        <h1>Configuration</h1>
        <p className="page-lead">
          Entreprise (et départements intégrés), matériel, conditionnements de vente, accès utilisateurs.
        </p>
      </header>

      <div className="config-tabs">
        {(
          [
            ['company', 'Entreprise'],
            ['printer', 'Imprimante'],
            ['packaging', 'Conditionnement'],
            ...(isAdmin ? [['users', 'Utilisateurs'] as const] : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id as Tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {msg ? <p className="info-text">{msg}</p> : null}

      {tab === 'company' && (
        <CompaniesSection
          onMessage={(m, o) => setMsg(m, o)}
        />
      )}

      {tab === 'printer' && (
        <div className="card form-grid">
          <h2>Imprimante et ticket (par département)</h2>
          <p className="page-lead" style={{ gridColumn: '1 / -1', marginTop: 0 }}>
            Choisissez l’entreprise puis le département : le design du ticket (en-tête, pied, logo) et le matériel
            s’appliquent à ce département. Le détail des lignes de vente reste celui de la caisse au moment de la
            vente ; la zone « texte de test » sert uniquement à prévisualiser et à l’impression d’essai.
          </p>
          <label>
            Entreprise
            <select
              value={printerCompanyId === '' ? '' : String(printerCompanyId)}
              onChange={(e) => {
                const v = e.target.value;
                setPrinterCompanyId(v ? Number(v) : '');
                setPrinterDepartmentId('');
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
              value={printerDepartmentId === '' ? '' : String(printerDepartmentId)}
              onChange={(e) => {
                const v = e.target.value;
                setPrinterDepartmentId(v ? Number(v) : '');
              }}
              disabled={printerCompanyId === ''}
            >
              <option value="">— Choisir</option>
              {printerDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {printerCompanyId !== '' && printerDepts.length === 0 ? (
            <p className="info-text" style={{ gridColumn: '1 / -1' }}>
              Aucun département pour cette entreprise. Ajoutez-en dans l’onglet Entreprise.
            </p>
          ) : null}

          {printerLoading ? (
            <p className="info-text" style={{ gridColumn: '1 / -1' }}>
              Chargement du profil…
            </p>
          ) : null}

          {printerForm && selectedPrinterCompany ? (
            <form
              className="form-grid"
              style={{ gridColumn: '1 / -1', display: 'contents' }}
              onSubmit={(e) => void savePrinter(e)}
            >
              <h3 style={{ gridColumn: '1 / -1', margin: '0.5rem 0 0' }}>Matériel</h3>
              <label>
                Largeur papier
                <select
                  value={printerForm.paperWidth}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, paperWidth: Number(e.target.value) })
                  }
                >
                  <option value={58}>58 mm</option>
                  <option value={80}>80 mm</option>
                </select>
              </label>
              <label>
                Imprimante Windows
                <select
                  value={printerForm.deviceName}
                  onChange={(e) => setPrinterForm({ ...printerForm, deviceName: e.target.value })}
                >
                  <option value="">— Défaut système</option>
                  {printersList.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    void window.desktopApp?.listPrinters?.()?.then(setPrintersList)
                  }
                >
                  Actualiser la liste
                </button>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={printerForm.autoCut}
                  onChange={(e) => setPrinterForm({ ...printerForm, autoCut: e.target.checked })}
                />
                Coupe automatique (ESC/POS)
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={printerForm.showLogoOnReceipt}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, showLogoOnReceipt: e.target.checked })
                  }
                />
                Afficher le logo sur le ticket
              </label>

              <h3 style={{ gridColumn: '1 / -1', margin: '1rem 0 0' }}>Mise en page du ticket</h3>
              <label style={{ gridColumn: '1 / -1' }}>
                En-tête (plusieurs lignes possibles)
                <textarea
                  rows={3}
                  value={printerForm.receiptHeaderText ?? ''}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, receiptHeaderText: e.target.value })
                  }
                  placeholder={`Sinon : nom de l’entreprise (${selectedPrinterCompany.name})`}
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Pied de page
                <textarea
                  rows={3}
                  value={printerForm.receiptFooterText ?? ''}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, receiptFooterText: e.target.value })
                  }
                  placeholder="Ex. Merci — TVA incluse — Site web…"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Logo ticket (image)
                <input
                  type="file"
                  className="input-file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith('image/')) {
                      setMsg('Choisissez une image (PNG, JPEG, WebP ou GIF).', { persist: true });
                      e.target.value = '';
                      return;
                    }
                    if (file.size > 900 * 1024) {
                      setMsg('Image trop volumineuse (max. ~900 Ko).', { persist: true });
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setPrinterForm((f) =>
                          f ? { ...f, receiptLogoUrl: reader.result as string } : f,
                        );
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {printerForm.receiptLogoUrl ? (
                <div className="logo-preview-block" style={{ gridColumn: '1 / -1' }}>
                  <img src={printerForm.receiptLogoUrl} alt="Aperçu logo ticket" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPrinterForm((f) => (f ? { ...f, receiptLogoUrl: null } : f))}
                  >
                    Retirer le logo
                  </button>
                </div>
              ) : null}
              <label style={{ gridColumn: '1 / -1' }}>
                Texte de test / prévisualisation (corps fictif)
                <textarea
                  rows={4}
                  value={printerForm.previewSampleBody ?? ''}
                  onChange={(e) =>
                    setPrinterForm({ ...printerForm, previewSampleBody: e.target.value })
                  }
                  placeholder="Lignes affichées à la place du détail de vente pour les essais…"
                />
              </label>

              <div style={{ gridColumn: '1 / -1' }}>
                <p className="dept-hint" style={{ marginBottom: '0.35rem' }}>
                  Aperçu (largeur proche du ticket)
                </p>
                <pre
                  className="ticket-preview-pre"
                  style={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'var(--surface-2, #f4f4f5)',
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.35,
                    overflow: 'auto',
                    maxHeight: 320,
                  }}
                >
                  {ticketPreviewText}
                </pre>
              </div>

              <div
                className="modal-actions"
                style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => void printTestTicket()}>
                  Imprimer un test
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer le profil
                </button>
              </div>
            </form>
          ) : printerDepartmentId !== '' && !printerLoading ? (
            <p className="info-text" style={{ gridColumn: '1 / -1' }}>
              Profil introuvable.
            </p>
          ) : null}
        </div>
      )}

      {tab === 'packaging' && <PackagingSection />}

      {tab === 'users' && isAdmin && (
        <UsersSection
          items={users}
          companies={companies}
          departments={departments}
          onChange={async () => setUsers(await getUsers())}
        />
      )}
    </div>
  );
}

type CompanyFormState = {
  name: string;
  legalName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  taxId: string;
  currency: string;
  vatRatePercent: number;
};

function emptyCompanyFormState(): CompanyFormState {
  return {
    name: '',
    legalName: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    taxId: '',
    currency: 'XOF',
    vatRatePercent: 0,
  };
}

function rowToFormState(row: CompanyListItem): CompanyFormState {
  return {
    name: row.name,
    legalName: row.legalName ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    country: row.country ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    taxId: row.taxId ?? '',
    currency: row.currency,
    vatRatePercent: Number(row.vatRatePercent),
  };
}

function formStateToPayload(f: CompanyFormState): CompanyCreatePayload {
  return {
    name: f.name.trim(),
    legalName: f.legalName.trim() || undefined,
    address: f.address.trim() || undefined,
    city: f.city.trim() || undefined,
    country: f.country.trim() || undefined,
    phone: f.phone.trim() || undefined,
    email: f.email.trim() || undefined,
    taxId: f.taxId.trim() || undefined,
    currency: f.currency.trim() || 'XOF',
    vatRatePercent: Number(f.vatRatePercent),
  };
}

function CompaniesSection({
  onMessage,
}: {
  onMessage: (m: string, options?: AutoClearMessageOptions) => void;
}) {
  const { can } = useAuth();
  const canCreate = can(['ADMIN']);
  const canEdit = can(['ADMIN', 'MANAGER']);
  const canDelete = can(['ADMIN']);

  const [rows, setRows] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; row: CompanyListItem }
  >(null);

  async function loadRows() {
    setLoading(true);
    try {
      const list = await getCompanies();
      setRows(list);
    } catch {
      onMessage('Impossible de charger la liste des entreprises (droits ou serveur).', {
        persist: true,
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0 }}>Entreprises</h2>
        {canCreate ? (
          <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'create' })}>
            Nouvelle entreprise
          </button>
        ) : null}
      </div>
      <p className="page-lead">
        Chaque entreprise regroupe ses départements (modifier une ligne pour les gérer). Les compteurs : produits,
        utilisateurs, départements.
      </p>
      {loading ? (
        <p className="info-text">Chargement…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Raison sociale</th>
              <th>Ville</th>
              <th>Produits</th>
              <th>Utilisateurs</th>
              <th>Départements</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.city ?? '—'}</td>
                <td>{row._count.products}</td>
                <td>{row._count.users}</td>
                <td>{row._count.departments}</td>
                <td>
                  {canEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setModal({ mode: 'edit', row })}
                    >
                      Modifier
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (!confirm(`Supprimer « ${row.name} » ?`)) return;
                        void deleteCompany(row.id)
                          .then(() => loadRows())
                          .then(() => onMessage('Entreprise supprimée.'))
                          .catch((err: unknown) => {
                            const msg =
                              axios.isAxiosError(err) &&
                              err.response?.data &&
                              typeof err.response.data === 'object' &&
                              err.response.data !== null &&
                              'message' in err.response.data
                                ? String((err.response.data as { message: unknown }).message)
                                : 'Suppression impossible.';
                            onMessage(msg, { persist: true });
                          });
                      }}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && rows.length === 0 ? (
        <p className="info-text">Aucune entreprise. Créez-en une ou exécutez le seed Prisma.</p>
      ) : null}

      {modal ? (
        <CompanyFormModal
          key={modal.mode === 'create' ? 'create' : `edit-${modal.row.id}`}
          mode={modal.mode}
          editId={modal.mode === 'edit' ? modal.row.id : undefined}
          initial={modal.mode === 'create' ? emptyCompanyFormState() : rowToFormState(modal.row)}
          onClose={() => setModal(null)}
          onCompanySaved={loadRows}
          onNotify={onMessage}
        />
      ) : null}
    </div>
  );
}

function CompanyFormModal({
  mode,
  editId,
  initial,
  onClose,
  onCompanySaved,
  onNotify,
}: {
  mode: 'create' | 'edit';
  editId?: number;
  initial: CompanyFormState;
  onClose: () => void;
  onCompanySaved: () => Promise<void>;
  onNotify: (msg: string, options?: AutoClearMessageOptions) => void;
}) {
  const [form, setForm] = useState<CompanyFormState>(initial);
  const [companyRecordId, setCompanyRecordId] = useState<number | null>(
    mode === 'edit' && editId != null ? editId : null,
  );
  const [err, setErr] = useAutoClearMessage();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) {
      setErr('La raison sociale est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = formStateToPayload(form);
      if (companyRecordId == null) {
        const created = await createCompany(payload);
        setCompanyRecordId(created.id);
        await onCompanySaved();
        onNotify('Entreprise créée. Ajoutez les départements ci-dessous.');
      } else {
        await updateCompany(companyRecordId, payload);
        await onCompanySaved();
        onNotify('Entreprise enregistrée.');
      }
    } catch {
      setErr(
        companyRecordId == null ? 'Création impossible.' : 'Enregistrement impossible.',
        { persist: true },
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal card modal-company" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <h2>{mode === 'create' ? 'Nouvelle entreprise' : 'Modifier l’entreprise'}</h2>
          <p className="dept-hint">
            Les départements appartiennent à cette entreprise (ex. services Marriott, unités Cursor). Ils
            servent à classer produits et activités dans Stock.
          </p>
        </div>
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          <label>
            Raison sociale *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Dénomination légale
            <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
          </label>
          <label>
            Adresse
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label>
            Ville
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label>
            Pays
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </label>
          <label>
            Téléphone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            N° TVA / identifiant fiscal
            <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </label>
          <p className="dept-hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
            Logo et textes du ticket (en-tête, pied) se règlent dans l’onglet <strong>Imprimante</strong>, par
            département.
          </p>
          <label>
            Devise
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </label>
          <label>
            TVA (%)
            <input
              type="number"
              step={0.01}
              min={0}
              value={form.vatRatePercent}
              onChange={(e) => setForm({ ...form, vatRatePercent: Number(e.target.value) })}
            />
          </label>
          {err ? <p className="error-text">{err}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Fermer
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : companyRecordId == null ? 'Créer l’entreprise' : 'Enregistrer'}
            </button>
          </div>
        </form>
        {companyRecordId != null ? (
          <CompanyDepartmentsPanel companyId={companyRecordId} onDepartmentsChanged={onCompanySaved} />
        ) : (
          <p className="dept-hint dept-embedded">
            Enregistrez d’abord l’entreprise (bouton ci-dessus) pour ajouter les départements.
          </p>
        )}
      </div>
    </div>
  );
}

function PackagingSection() {
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [items, setItems] = useState<PackagingUnit[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [code, setCode] = useState('UNITE');
  const [label, setLabel] = useState('Unité');
  const [msg, setMsg] = useAutoClearMessage();
  const [saving, setSaving] = useState(false);
  const [editRow, setEditRow] = useState<PackagingUnit | null>(null);

  const deptsForCompany = useMemo(
    () => (companyId === '' ? [] : departments.filter((d) => d.companyId === companyId)),
    [departments, companyId],
  );

  async function refreshMeta() {
    const [co, d] = await Promise.all([getCompanies(), getDepartments()]);
    setCompanies(co);
    setDepartments(d);
  }

  useEffect(() => {
    void refreshMeta().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (companies.length && companyId === '') setCompanyId(companies[0].id);
  }, [companies, companyId]);

  useEffect(() => {
    if (deptsForCompany.length === 0) {
      setDepartmentId('');
      return;
    }
    setDepartmentId((prev) => {
      if (prev !== '' && deptsForCompany.some((d) => d.id === prev)) return prev;
      return deptsForCompany[0].id;
    });
  }, [deptsForCompany]);

  useEffect(() => {
    if (departmentId === '') {
      setItems([]);
      return;
    }
    setLoadingList(true);
    void getPackagingUnits(departmentId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoadingList(false));
  }, [departmentId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (departmentId === '') {
      setMsg('Choisissez un département.', { persist: true });
      return;
    }
    setSaving(true);
    try {
      await createPackagingUnit({
        departmentId,
        code: code.trim().toUpperCase(),
        label: label.trim(),
      });
      setCode('');
      setLabel('');
      setItems(await getPackagingUnits(departmentId));
    } catch {
      setMsg('Code déjà utilisé pour ce département ou invalide (MAJUSCULES_UNDERSCORES).', {
        persist: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Conditionnements de vente</h2>
      <p className="page-lead">
        Chaque conditionnement est rattaché à un <strong>département</strong> (ex. unité, caisse, gallon pour
        l’épicerie ; autre liste pour l’hôtel). Les codes sont en MAJUSCULES (UNITE, CAISSE…).
      </p>
      <p className="dept-hint" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refreshMeta()}>
          Actualiser entreprises / départements
        </button>
      </p>

      <div className="form-grid inline" style={{ marginBottom: '0.75rem' }}>
        <label>
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
        <label>
          Département (liste des conditionnements)
          <select
            value={departmentId === '' ? '' : String(departmentId)}
            onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
            disabled={deptsForCompany.length === 0}
          >
            {deptsForCompany.length === 0 ? (
              <option value="">— Aucun département</option>
            ) : (
              deptsForCompany.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <section className="dept-form-card" style={{ marginTop: '0.75rem' }}>
        <h3 id="packaging-new">Nouveau conditionnement</h3>
        <p className="dept-hint">S’applique au département sélectionné ci-dessus.</p>
        <form className="form-grid inline" onSubmit={(e) => void add(e)}>
          <input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} required />
          <input placeholder="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} required />
          <button type="submit" className="btn btn-primary" disabled={saving || departmentId === ''}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
        {msg ? <p className="error-text">{msg}</p> : null}
      </section>

      {loadingList ? <p className="info-text">Chargement…</p> : null}

      <h3 className="dept-list-title" style={{ marginTop: '1rem' }}>
        Liste pour ce département ({items.length})
      </h3>
      <ul className="simple-list">
        {items.map((u) => (
          <li key={u.id} className="simple-list-row">
            <span>
              <strong>{u.code}</strong> — {u.label}
            </span>
            <span style={{ display: 'flex', gap: '0.35rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditRow(u)}>
                Modifier
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (!confirm(`Supprimer « ${u.label} » (${u.code}) ?`)) return;
                  void deletePackagingUnit(u.id).then(async () => {
                    if (departmentId !== '') setItems(await getPackagingUnits(departmentId));
                  });
                }}
              >
                Supprimer
              </button>
            </span>
          </li>
        ))}
      </ul>

      {editRow && departmentId !== '' ? (
        <PackagingEditModal
          row={editRow}
          companies={companies}
          departments={departments}
          onClose={() => setEditRow(null)}
          onSaved={async () => {
            setEditRow(null);
            setItems(await getPackagingUnits(departmentId));
          }}
        />
      ) : null}
    </div>
  );
}

function PackagingEditModal({
  row,
  companies,
  departments,
  onClose,
  onSaved,
}: {
  row: PackagingUnit;
  companies: CompanyListItem[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const deptMeta = departments.find((d) => d.id === row.departmentId);
  const initialCo =
    row.department?.companyId ?? deptMeta?.companyId ?? companies[0]?.id ?? '';
  const [companyId, setCompanyId] = useState<number | ''>(
    typeof initialCo === 'number' ? initialCo : '',
  );
  const [departmentId, setDepartmentId] = useState<number | ''>(row.departmentId);
  const [code, setCode] = useState(row.code);
  const [label, setLabel] = useState(row.label);
  const [err, setErr] = useAutoClearMessage();
  const [saving, setSaving] = useState(false);

  const deptsForCompany = useMemo(
    () => (companyId === '' ? [] : departments.filter((d) => d.companyId === companyId)),
    [departments, companyId],
  );

  useEffect(() => {
    if (companyId === '') return;
    if (deptsForCompany.length && !deptsForCompany.some((d) => d.id === departmentId)) {
      setDepartmentId(deptsForCompany[0].id);
    }
  }, [companyId, deptsForCompany, departmentId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (departmentId === '') {
      setErr('Choisissez un département.');
      return;
    }
    setSaving(true);
    try {
      await updatePackagingUnit(row.id, {
        departmentId,
        code: code.trim().toUpperCase(),
        label: label.trim(),
      });
      await onSaved();
    } catch {
      setErr('Enregistrement impossible (code en double ou conditionnement utilisé par des produits).', {
        persist: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier le conditionnement</h2>
        <p className="dept-hint">
          Le changement de département est refusé si des produits utilisent déjà ce conditionnement.
        </p>
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          <label>
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
          <label>
            Département
            <select
              value={departmentId === '' ? '' : String(departmentId)}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
            >
              {deptsForCompany.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Code
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <label>
            Libellé
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          {err ? <p className="error-text">{err}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Fermer
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DepartmentEditModal({
  department,
  onClose,
  onSaved,
}: {
  department: Department;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? '');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!name.trim()) {
      setErr('Le nom du département est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      await updateDepartment(department.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await onSaved();
      onClose();
    } catch {
      setErr('Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading">
          <h2>Modifier le département</h2>
          <p className="dept-hint">Nom et description affichés dans la liste.</p>
        </div>
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          <label>
            Nom *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Description (optionnel)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mission, périmètre…"
            />
          </label>
          {err ? <p className="error-text">{err}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompanyDepartmentsPanel({
  companyId,
  onDepartmentsChanged,
}: {
  companyId: number;
  onDepartmentsChanged: () => Promise<void>;
}) {
  const { can } = useAuth();
  const canEdit = can(['ADMIN', 'MANAGER']);
  const canDelete = can(['ADMIN']);

  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deptErr, setDeptErr] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [deptProducts, setDeptProducts] = useState<Product[]>([]);
  const [editDept, setEditDept] = useState<Department | null>(null);

  async function loadDepts() {
    setLoading(true);
    try {
      setItems(await getDepartments(companyId));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDepts();
  }, [companyId]);

  async function addDepartment() {
    if (!canEdit) return;
    setDeptErr('');
    const trimmed = name.trim();
    if (!trimmed) {
      setDeptErr('Indiquez un nom pour le département.');
      return;
    }
    setAddingDept(true);
    try {
      await createDepartment({
        name: trimmed,
        description: description.trim() || undefined,
        companyId,
      });
      setName('');
      setDescription('');
      await loadDepts();
      await onDepartmentsChanged();
    } catch (err) {
      let msg = 'Impossible d’ajouter le département.';
      if (axios.isAxiosError(err) && err.response) {
        const d = err.response.data;
        if (typeof d === 'object' && d !== null && 'message' in d) {
          const m = (d as { message: unknown }).message;
          msg = Array.isArray(m) ? m.join(', ') : String(m);
        } else if (err.response.status === 403) {
          msg = 'Droits insuffisants (administrateur ou gestionnaire requis).';
        }
      }
      setDeptErr(msg);
    } finally {
      setAddingDept(false);
    }
  }

  async function toggleProducts(deptId: number) {
    if (expandedId === deptId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(deptId);
    setLoadingProducts(true);
    try {
      const list = await getProducts(deptId);
      setDeptProducts(list);
    } catch {
      setDeptProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  return (
    <div className="dept-embedded dept-section">
      <h3 className="dept-list-title">Départements de cette entreprise</h3>
      <p className="dept-intro">
        Une même entreprise peut regrouper plusieurs départements (ex. hôtel, spa, boutique). Chaque produit ou
        service est rattaché à l’entreprise et au département concerné dans Stock.
      </p>

      <section className="dept-form-card" aria-labelledby="dept-new-embedded">
        <h3 id="dept-new-embedded">Ajouter un département</h3>
        <div className="dept-form-grid">
          <label>
            Nom *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Hôtel, Spa, Location véhicules"
              disabled={!canEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addDepartment();
                }
              }}
            />
          </label>
          <label>
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              disabled={!canEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addDepartment();
                }
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canEdit || addingDept}
            onClick={() => void addDepartment()}
          >
            {addingDept ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
        {deptErr ? <p className="error-text">{deptErr}</p> : null}
        {!canEdit ? (
          <p className="dept-hint" style={{ marginTop: '0.5rem' }}>
            Seuls les administrateurs et gestionnaires peuvent ajouter ou modifier des départements.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="dept-list-embedded">
        <h3 id="dept-list-embedded" className="dept-list-title">
          Liste ({loading ? '…' : items.length})
        </h3>
        {loading ? (
          <p className="dept-hint">Chargement des départements…</p>
        ) : items.length === 0 ? (
          <p className="dept-empty">Aucun département. Ajoutez-en ci-dessus.</p>
        ) : (
          items.map((d) => (
            <article key={d.id} className="dept-card">
              <div className="dept-card-header">
                <div className="dept-card-titles">
                  <span className="dept-card-name">{d.name}</span>
                  {d.description ? <span className="dept-card-meta">{d.description}</span> : null}
                </div>
                <div className="dept-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void toggleProducts(d.id)}
                    aria-expanded={expandedId === d.id}
                  >
                    {expandedId === d.id ? 'Fermer' : 'Produits'}
                  </button>
                  {canEdit ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditDept(d)}>
                      Modifier
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (
                          !confirm(
                            `Supprimer « ${d.name} » ? Les produits liés n’auront plus de département.`,
                          )
                        ) {
                          return;
                        }
                        void deleteDepartment(d.id)
                          .then(() => loadDepts())
                          .then(() => onDepartmentsChanged());
                      }}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>
              </div>
              {expandedId === d.id ? (
                <div className="dept-card-body">
                  <p className="dept-card-body-title">Produits rattachés à ce département</p>
                  {loadingProducts ? (
                    <p className="dept-hint">Chargement…</p>
                  ) : deptProducts.length === 0 ? (
                    <p className="dept-hint">
                      Aucun produit. Dans <strong>Stock</strong>, choisissez cette entreprise et ce département
                      pour le produit.
                    </p>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deptProducts.map((p) => (
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              <td>{Number(p.stock).toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      {editDept ? (
        <DepartmentEditModal
          key={editDept.id}
          department={editDept}
          onClose={() => setEditDept(null)}
          onSaved={async () => {
            await loadDepts();
            await onDepartmentsChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function userDepartmentLabel(
  departmentId: number | null | undefined,
  departments: Department[],
): string {
  if (departmentId == null) return '—';
  const d = departments.find((x) => x.id === departmentId);
  if (!d) return '—';
  return d.company ? `${d.company.name} — ${d.name}` : d.name;
}

function UsersSection({
  items,
  companies,
  departments,
  onChange,
}: {
  items: SessionUser[];
  companies: CompanyListItem[];
  departments: Department[];
  onChange: () => Promise<void>;
}) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState<string>('CASHIER');
  const [fullName, setFullName] = useState('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [msg, setMsg] = useAutoClearMessage();
  const [editUser, setEditUser] = useState<SessionUser | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    if (role !== 'ADMIN' && deptId === '') {
      setMsg(
        'Choisissez un département pour ce rôle (les administrateurs globaux n’en ont pas besoin).',
        { persist: true },
      );
      return;
    }
    if (password !== passwordConfirm) {
      setMsg('Les mots de passe ne correspondent pas.', { persist: true });
      return;
    }
    try {
      await createUser({
        phone: phone.trim(),
        password,
        role,
        fullName: fullName || undefined,
        departmentId: role === 'ADMIN' ? undefined : Number(deptId),
      });
      setPhone('');
      setPassword('');
      setPasswordConfirm('');
      setFullName('');
      await onChange();
    } catch (err) {
      setMsg(formatApiError(err, 'Création impossible.'), { persist: true });
    }
  }

  return (
    <div className="card">
      <h2>Utilisateurs</h2>
      <p className="page-lead" style={{ marginTop: 0 }}>
        Connexion par <strong>téléphone</strong> et mot de passe. Les rôles autres qu’<strong>ADMIN</strong> doivent
        être rattachés à un <strong>département</strong> ; les administrateurs ont un accès global sans rattachement.
      </p>
      {msg ? <p className="error-text">{msg}</p> : null}

      <section aria-labelledby="users-list-heading">
        <h3 id="users-list-heading" className="dept-list-title" style={{ marginTop: 0 }}>
          Liste ({items.length})
        </h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Téléphone</th>
                <th>Nom affiché</th>
                <th>Rôle</th>
                <th>Département</th>
                <th>Actif</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.phone}</td>
                  <td>{(u.fullName || '').trim() || '—'}</td>
                  <td>{u.role}</td>
                  <td>{userDepartmentLabel(u.departmentId, departments)}</td>
                  <td>{u.isActive ? 'oui' : 'non'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          void updateUser(u.id, { isActive: !u.isActive }).then(() => onChange())
                        }
                      >
                        {u.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditUser(u)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (!confirm('Supprimer cet utilisateur ?')) return;
                          void deleteUser(u.id)
                            .then(() => onChange())
                            .catch((err) =>
                              setMsg(formatApiError(err, 'Suppression impossible.'), {
                                persist: true,
                              }),
                            );
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 ? (
          <p className="info-text" style={{ marginTop: '0.5rem' }}>
            Aucun utilisateur. Créez un compte ci-dessous.
          </p>
        ) : null}
      </section>

      <section className="dept-form-card" aria-labelledby="users-new-heading" style={{ marginTop: '1.25rem' }}>
        <h3 id="users-new-heading">Nouvel utilisateur</h3>
        <form className="form-grid" onSubmit={(e) => void add(e)}>
          <label>
            Numéro de téléphone (identifiant de connexion)
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225…"
              required
            />
          </label>
          <PasswordField
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <PasswordField
            label="Confirmer le mot de passe"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <label>
            Nom affiché
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            Rôle
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value;
                setRole(r);
                if (r === 'ADMIN') setDeptId('');
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {role === 'ADMIN' ? (
            <p className="info-text" style={{ margin: 0, alignSelf: 'end' }}>
              Administrateur global : pas d’entreprise ni de département.
            </p>
          ) : (
            <label>
              Département d’affectation *
              <select
                value={deptId === '' ? '' : String(deptId)}
                onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : '')}
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
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary">
              Créer l’utilisateur
            </button>
          </div>
        </form>
      </section>

      {editUser ? (
        <UserEditModal
          key={editUser.id}
          user={editUser}
          companies={companies}
          departments={departments}
          onClose={() => setEditUser(null)}
          onSaved={async () => {
            setEditUser(null);
            await onChange();
          }}
          onError={(m) => setMsg(m, { persist: true })}
        />
      ) : null}
    </div>
  );
}

function UserEditModal({
  user,
  companies,
  departments,
  onClose,
  onSaved,
  onError,
}: {
  user: SessionUser;
  companies: CompanyListItem[];
  departments: Department[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { user: sessionUser, refreshUser } = useAuth();
  const deptMeta = user.departmentId != null
    ? departments.find((d) => d.id === user.departmentId)
    : undefined;
  const initialCompanyId =
    user.role === 'ADMIN' ? '' : user.companyId ?? deptMeta?.companyId ?? '';

  const [companyId, setCompanyId] = useState<number | ''>(
    typeof initialCompanyId === 'number' ? initialCompanyId : '',
  );
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [role, setRole] = useState<string>(user.role);
  const [departmentId, setDepartmentId] = useState<number | ''>(
    user.role === 'ADMIN' ? '' : user.departmentId != null ? user.departmentId : '',
  );
  const [err, setErr] = useAutoClearMessage();
  const [saving, setSaving] = useState(false);

  const deptsForCompany = useMemo(
    () => (companyId === '' ? [] : departments.filter((d) => d.companyId === companyId)),
    [departments, companyId],
  );

  useEffect(() => {
    if (role === 'ADMIN') return;
    if (companyId === '') return;
    if (departmentId !== '' && !deptsForCompany.some((d) => d.id === departmentId)) {
      setDepartmentId(deptsForCompany[0]?.id ?? '');
    }
  }, [companyId, deptsForCompany, departmentId, role]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const p = phone.trim();
    if (p.length < 6) {
      setErr('Le numéro de téléphone est trop court (minimum 6 caractères).');
      return;
    }
    if (role !== 'ADMIN' && departmentId === '') {
      setErr('Choisissez un département pour ce rôle (sauf administrateur global).');
      return;
    }
    const pw = password.trim();
    const pw2 = passwordConfirm.trim();
    if (pw || pw2) {
      if (!pw) {
        setErr('Saisissez le nouveau mot de passe ou videz la confirmation.');
        return;
      }
      if (pw.length < 6) {
        setErr('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (pw !== pw2) {
        setErr('Les mots de passe ne correspondent pas.');
        return;
      }
    }
    setSaving(true);
    try {
      await updateUser(user.id, {
        phone: p,
        email: email.trim() === '' ? null : email.trim(),
        ...(pw ? { password: pw } : {}),
        fullName: fullName.trim() || undefined,
        role,
        ...(role === 'ADMIN'
          ? { companyId: null, departmentId: null }
          : {
              companyId: companyId === '' ? null : companyId,
              departmentId: departmentId === '' ? null : departmentId,
            }),
      });
      if (sessionUser?.id === user.id) {
        try {
          await refreshUser();
        } catch {
          // If profile refresh fails, keep update result and let global auth flow handle re-login if needed.
        }
      }
      await onSaved();
    } catch (err) {
      onError(formatApiError(err, 'Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal card" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Modifier l’utilisateur</h2>
        <p className="dept-hint">
          Laissez le mot de passe vide pour le conserver. Le téléphone sert d’identifiant de connexion.
        </p>
        {err ? <p className="error-text">{err}</p> : null}
        <form className="form-grid" onSubmit={(e) => void submit(e)}>
          <label>
            Téléphone *
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label>
            Email (optionnel)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <PasswordField
            label="Nouveau mot de passe (optionnel)"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="Vide = inchangé"
          />
          <PasswordField
            label="Confirmer le mot de passe"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
            placeholder="Si vous changez le mot de passe"
          />
          <label>
            Nom affiché
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label>
            Rôle
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value;
                setRole(r);
                if (r === 'ADMIN') {
                  setCompanyId('');
                  setDepartmentId('');
                }
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {role === 'ADMIN' ? (
            <p className="info-text" style={{ margin: 0, alignSelf: 'end' }}>
              Accès global : aucune entreprise ni département.
            </p>
          ) : (
            <>
              <label>
                Entreprise
                <select
                  value={companyId === '' ? '' : String(companyId)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCompanyId(v ? Number(v) : '');
                    setDepartmentId('');
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
                Département *
                <select
                  value={departmentId === '' ? '' : String(departmentId)}
                  onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  disabled={companyId === ''}
                  required
                >
                  <option value="">— Choisir</option>
                  {deptsForCompany.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
