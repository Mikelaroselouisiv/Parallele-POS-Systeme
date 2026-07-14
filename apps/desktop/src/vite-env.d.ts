/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Flavor desktop : `server` (API locale) ou `remote` (GCP + auto-découverte). */
  readonly VITE_APP_EDITION?: 'server' | 'remote';
  /** URL du backend Nest (ex. http://localhost:3000 en dev, https://api.example.com en prod). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
