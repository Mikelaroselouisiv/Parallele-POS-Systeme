import { getAppEdition } from './edition';
import { LOCAL_API_BASE_URL, PUBLIC_API_BASE_URL } from './public-api';

const LOCAL_PROBE_TIMEOUT_MS = 2000;

async function probeLocalApi(timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${LOCAL_API_BASE_URL}/auth/setup-status`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server → localhost:3000.
 * Remote → tente localhost (2 s), sinon URL GCP publique.
 * `VITE_API_URL` surcharge toujours.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  const override = import.meta.env.VITE_API_URL?.trim();
  if (override) return override;

  if (getAppEdition() === 'server') {
    return LOCAL_API_BASE_URL;
  }

  const localReachable = await probeLocalApi(LOCAL_PROBE_TIMEOUT_MS);
  return localReachable ? LOCAL_API_BASE_URL : PUBLIC_API_BASE_URL;
}
