const DEFAULT_PROD_URL = 'http://34.118.154.220';

/** Équivalent mobile du `VITE_API_URL` desktop — surchargeable via .env (EXPO_PUBLIC_API_URL). */
export function resolveApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL?.trim();
  return override || DEFAULT_PROD_URL;
}
