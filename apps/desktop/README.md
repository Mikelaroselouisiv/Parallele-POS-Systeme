# POS Desktop (Electron + React)

Application desktop POS dans `apps/desktop`, connectee au backend NestJS via **`VITE_API_URL`** (voir ci-dessous).

## URL du backend (dev vs prod)

- **Développement** : le fichier **`.env.development`** fixe `VITE_API_URL=http://localhost:3000` — l’Electron parle au **Nest lancé sur ta machine** (pas à l’image sur l’EC2, tant que tu n’as pas changé cette variable).
- **Build installable / prod** : définir `VITE_API_URL` vers ton API déployée (ex. `http://IP_EC2:3000` ou un domaine HTTPS) dans `.env.production` ou les variables d’environnement du build. Copier **`.env.example`** comme modèle.

### Mode semi-autonome (SQLite)

- Fichier **`pos-local.sqlite`** dans le répertoire utilisateur de l’app (Electron `userData`) : **file d’attente des ventes** hors ligne + **cache du catalogue** produits.
- Au retour réseau, la file est synchronisée vers l’API (`POST /sales`). Le badge **« N hors ligne »** dans la barre latérale indique les ventes en attente.
- En développement, **`VITE_API_URL`** reste sur `localhost:3000` (`.env.development`). Pour un build pointant vers l’EC2, définir **`VITE_API_URL`** au moment du build (voir `.env.production.example`).

La persistance utilise **sql.js** (SQLite compilé en WebAssembly, sans module natif à compiler).

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
