/**
 * URL publique du backend Nest (Google Compute Engine ou domaine).
 * À modifier ici si l’IP ou le domaine change — pas besoin de variable d’environnement pour un build normal.
 * (Une variable `VITE_API_URL` surcharge encore cette valeur si elle est définie au build.)
 */
/** Port 80 via Nginx → Nest sur :3000 (voir infra/nginx/pos-api.conf). */
export const PUBLIC_API_BASE_URL = 'http://34.118.154.220';
