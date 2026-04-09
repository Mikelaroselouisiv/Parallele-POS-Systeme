/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du backend Nest (ex. http://localhost:3000 en dev, https://api.example.com en prod). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
