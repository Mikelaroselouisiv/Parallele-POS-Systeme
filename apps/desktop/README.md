# POS Desktop (Electron + React)

Application desktop POS dans `apps/desktop`, connectee au backend NestJS sur `http://localhost:3000`.

## Logo & identité visuelle

- **Fichier unique** à la racine du monorepo : **`assets/icons/icon.png`** (PNG recommandé).
- Au lancement (`npm run dev` / `npm run build`), Vite **copie** ce fichier vers `apps/desktop/public/icon.png` (favicon + `dist/`).
- L’interface React et la fenêtre Electron **lisent** ce même fichier via le monorepo (`@monorepo-assets/...`). Pour changer le logo : remplacez **`assets/icons/icon.png`**, puis relancez le dev ou le build.

## Structure

- `src/main`: process Electron (`main.cjs`, `preload.cjs`)
- `src/renderer`: interface React (login, produits, panier, vente)
- `src/renderer/services/api.ts`: appels API backend

## Commandes

- `npm install`
- `npm run dev` : lance Vite + Electron en mode developpement
- `npm run build` : build React renderer
- `npm run start` : lance Electron en mode local

## Fonctionnalites POS incluses

- Login utilisateur (`/auth/login`)
- Liste des produits (`/products`)
- Panier local avec total
- Validation vente (`/sales`)
- Gestion loading + erreurs basiques
