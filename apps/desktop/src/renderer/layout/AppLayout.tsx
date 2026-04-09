import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { pendingSalesCount, syncSalesQueue } from '../services/offline-queue';
import type { UserRole } from '../types/api';

const nav: Array<{ to: string; label: string; roles: UserRole[] }> = [
  { to: '/app/dashboard', label: 'Tableau de bord', roles: ['ADMIN'] },
  { to: '/app/stock', label: 'Stock & produits', roles: ['ADMIN', 'MANAGER', 'STOCK_MANAGER'] },
  { to: '/app/pos', label: 'Caisse (POS)', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/app/config', label: 'Configuration', roles: ['ADMIN', 'MANAGER'] },
];

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [pendingSales, setPendingSales] = useState(0);

  const refreshPending = useCallback(() => {
    void pendingSalesCount().then(setPendingSales);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const onPendingChanged = () => refreshPending();
    window.addEventListener('pos-pending-sales-changed', onPendingChanged);
    return () => window.removeEventListener('pos-pending-sales-changed', onPendingChanged);
  }, [refreshPending]);

  useEffect(() => {
    const onOnline = () => {
      void syncSalesQueue()
        .then((r) => {
          refreshPending();
          if (r.synced > 0) {
            window.dispatchEvent(new CustomEvent('pos-offline-synced', { detail: r }));
          }
        })
        .catch(() => undefined);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refreshPending]);

  const visible = nav.filter((item) => can(item.roles));

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <BrandLogo size={40} />
          <span className="app-brand-text">Frères Basiles</span>
          {pendingSales > 0 ? (
            <span className="app-offline-badge" title="Ventes en attente de synchronisation">
              {pendingSales} hors ligne
            </span>
          ) : null}
        </div>
        <nav className="app-nav">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'app-nav-link active' : 'app-nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <div className="app-user">
            <div className="app-user-email">{user?.phone}</div>
            <div className="app-user-role">{user?.role}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
