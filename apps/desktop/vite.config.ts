import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');
const repoIcon = path.join(monorepoRoot, 'assets', 'icons', 'icon.png');
const publicIcon = path.join(__dirname, 'public', 'icon.png');
const electronBuilderIcon = path.join(__dirname, 'build', 'icon.png');
const electronBuilderIco = path.join(__dirname, 'build', 'icon.ico');

/** Source unique : `assets/icons/icon.png` → public + build (PNG + ICO). */
function syncRepoIconToPublic() {
  try {
    if (!fs.existsSync(repoIcon)) {
      console.warn('[vite] Logo absent :', repoIcon);
      return;
    }
    fs.mkdirSync(path.dirname(publicIcon), { recursive: true });
    fs.copyFileSync(repoIcon, publicIcon);
    fs.mkdirSync(path.dirname(electronBuilderIcon), { recursive: true });
    fs.copyFileSync(repoIcon, electronBuilderIcon);
    if (fs.existsSync(electronBuilderIco)) {
      fs.copyFileSync(electronBuilderIco, path.join(__dirname, 'public', 'icon.ico'));
    }
  } catch (e) {
    console.warn('[vite] Sync logo assets/icons/icon.png :', e);
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
