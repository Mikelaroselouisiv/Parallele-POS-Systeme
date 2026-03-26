import type { Product } from '../types/api';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  loading: boolean;
}

function defaultPrice(p: Product) {
  const u = p.saleUnits?.find((s) => s.isDefault) ?? p.saleUnits?.[0];
  return u ? Number(u.salePrice) : 0;
}

export function ProductList({ products, onAddToCart, loading }: ProductListProps) {
  return (
    <div className="card">
      <h2>Produits</h2>
      {loading ? (
        <p>Chargement des produits...</p>
      ) : (
        <div className="product-list">
          {products.map((product) => {
            const price = defaultPrice(product);
            const stock = Number(product.stock);
            return (
              <div className="product-item" key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <p>Stock: {stock}</p>
                </div>
                <div className="product-right">
                  <strong>{price.toFixed(2)}</strong>
                  <button
                    type="button"
                    disabled={stock <= 0 && product.trackStock}
                    onClick={() => onAddToCart(product)}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
