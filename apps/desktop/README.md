# POS Desktop (Electron + React)

Application desktop POS dans `apps/desktop`, connectee au backend NestJS sur `http://localhost:3000`.

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
