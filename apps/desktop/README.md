# POS Desktop (Electron + React)

Application desktop POS dans `apps/desktop`, connectee au backend NestJS (voir **`src/renderer/config/public-api.ts`**).

## URL du backend (dev vs prod)

- **Production (installateur / `vite build`)** : constante **`PUBLIC_API_BASE_URL`** dans **`src/renderer/config/public-api.ts`** (IP ou domaine du serveur déployé). C’est l’endroit unique à modifier si l’URL change.
- **Développement** (`npm run dev`) : **`http://localhost:3000`** par défaut (Nest local), sans configuration.
- **Surcharge optionnelle** : variable **`VITE_API_URL`** au build (CI, test) — voir `.env.production.example`.

### Mode semi-autonome (SQLite)

- Fichier **`pos-local.sqlite`** dans le répertoire utilisateur de l’app (Electron `userData`) : **file d’attente des ventes** hors ligne + **cache du catalogue** produits.
- Au retour réseau, la file est synchronisée vers l’API (`POST /sales`). Le badge **« N hors ligne »** dans la barre latérale indique les ventes en attente.

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
- `npm run start` : lance Electron en mode local (après `npm run build`)
- **`npm run dist:win`** : build + **installateur Windows** (`release/POS Frères Basiles Setup x.x.x.exe`). Sans certificat de signature : `forceCodeSigning` est désactivé dans `package.json` (Windows peut afficher « éditeur inconnu »).

Pour un autre serveur que celui défini dans `public-api.ts`, modifie **`PUBLIC_API_BASE_URL`** ou utilise **`VITE_API_URL`** au build, puis `npm run dist:win`.

### L’installateur ne joint pas l’API (EC2)

1. **Security group AWS** : autoriser le trafic **entrant TCP 3000** vers l’instance (depuis ton IP ou `0.0.0.0/0` pour test). Sans cette règle, rien n’atteint Nest depuis ton PC.
2. Vérifier dans le navigateur : `http://TON_IP:3000/auth/setup-status` doit afficher du JSON.
3. Rebuild l’exe seulement si tu changes le code Electron ou l’URL dans `public-api.ts`.

## Fonctionnalites POS incluses

- Login utilisateur (`/auth/login`)
- Liste des produits (`/products`)
- Panier local avec total
- Validation vente (`/sales`)
- Gestion loading + erreurs basiques
