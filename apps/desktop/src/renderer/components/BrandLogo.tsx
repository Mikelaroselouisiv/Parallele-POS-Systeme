/**
 * Logo entreprise : source unique du monorepo `assets/icons/icon.png`
 * (alias Vite `@monorepo-assets/icons/icon.png`).
 */
import logoUrl from '@monorepo-assets/icons/icon.png';

export function BrandLogo({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt=""
      className={`brand-logo-img ${className}`.trim()}
      style={{ objectFit: 'contain' }}
      aria-hidden
    />
  );
}
