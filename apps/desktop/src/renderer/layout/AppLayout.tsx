import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
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

  const visible = nav.filter((item) => can(item.roles));

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <BrandLogo size={40} />
          <span className="app-brand-text">Frères Basiles</span>
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
