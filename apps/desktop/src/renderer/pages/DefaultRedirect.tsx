import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'CASHIER':
      return <Navigate to="/app/pos" replace />;
    case 'STOCK_MANAGER':
      return <Navigate to="/app/stock" replace />;
    case 'ACCOUNTANT':
      return <Navigate to="/app/dashboard" replace />;
    default:
      return <Navigate to="/app/dashboard" replace />;
  }
}
