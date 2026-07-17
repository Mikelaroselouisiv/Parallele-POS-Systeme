import type { Product } from '../types/api';
import { formatMoney } from '../utils/currency';

export interface CartItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface CartPanelProps {
  items: CartItem[];
  onIncrease: (product: Product) => void;
  onDecrease: (productId: number) => void;
  onCheckout: () => Promise<void>;
  productsById: Map<number, Product>;
  loading: boolean;
}

export function CartPanel({
  items,
  onIncrease,
  onDecrease,
  onCheckout,
  productsById,
  loading,
}: CartPanelProps) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="card">
      <h2>Panier POS</h2>
      {items.length === 0 ? (
        <p>Ajoute des produits pour creer une vente.</p>
      ) : (
        <div className="cart-list">
          {items.map((item) => (
            <div className="cart-item" key={item.productId}>
              <div>
                <strong>{item.name}</strong>
                <p>{formatMoney(item.unitPrice)}</p>
              </div>
              <div className="cart-actions">
                <button type="button" onClick={() => onDecrease(item.productId)}>
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => {
                    const product = productsById.get(item.productId);
                    if (product) onIncrease(product);
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <div className="cart-total">
            <strong>Total : {formatMoney(total)}</strong>
            <button type="button" onClick={onCheckout} disabled={loading}>
              {loading ? 'Validation...' : 'Valider vente'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
