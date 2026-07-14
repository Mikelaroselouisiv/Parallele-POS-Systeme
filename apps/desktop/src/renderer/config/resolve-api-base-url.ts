import { getAppEdition } from './edition';
import { LOCAL_API_BASE_URL, PUBLIC_API_BASE_URL } from './public-api';

/**
 * Server → localhost:3000.
 * Remote → URL GCP publique.
 *
 * Ne jamais basculer automatiquement un Remote vers localhost : l'outbox
 * contient les identifiants du backend GCP et doit être rejouée sur ce même nœud.
 * `VITE_API_URL` surcharge toujours.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  const override = import.meta.env.VITE_API_URL?.trim();
  if (override) return override;

  if (getAppEdition() === 'server') {
    return LOCAL_API_BASE_URL;
  }

  return PUBLIC_API_BASE_URL;
}
