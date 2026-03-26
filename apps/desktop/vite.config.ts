import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');
const repoIcon = path.join(monorepoRoot, 'assets', 'icons', 'icon.png');
const publicIcon = path.join(__dirname, 'public', 'icon.png');

/** Source unique du logo : `POS-Freres-Baziles/assets/icons/icon.png` → copié vers `public/icon.png` (favicon / dist). */
function syncRepoIconToPublic() {
  try {
    if (fs.existsSync(repoIcon)) {
      fs.mkdirSync(path.dirname(publicIcon), { recursive: true });
      fs.copyFileSync(repoIcon, publicIcon);
    }
  } catch (e) {
    console.warn('[vite] Sync logo assets/icons/icon.png → public/icon.png :', e);
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-repo-icon',
      buildStart: syncRepoIconToPublic,
      configureServer: syncRepoIconToPublic,
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@monorepo-assets': path.join(monorepoRoot, 'assets'),
    },
  },
});
