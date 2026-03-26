# POS-Freres-Baziles Monorepo

Structure monorepo cible pour l'ecosysteme POS Freres Baziles.

## Arborescence

- `apps/backend` : API NestJS + Prisma + PostgreSQL
- `apps/mobile` : application mobile (placeholder)
- `apps/desktop` : application desktop (placeholder)
- `packages/ui` : composants UI partages
- `packages/types` : types TypeScript partages
- `packages/utils` : utilitaires partages
- `assets/logos`, `assets/icons`, `assets/images`, `assets/fonts`
- `infra/docker`, `infra/aws`
- `docs`

## Dépôt GitHub

Dépôt distant : [github.com/Mikelaroselouisiv/Parallele-POS-Systeme](https://github.com/Mikelaroselouisiv/Parallele-POS-Systeme).

### Première publication (machine locale)

1. Installez [Git pour Windows](https://git-scm.com/download/win) si besoin, puis ouvrez un terminal dans la racine du monorepo (`POS-Freres-Baziles`).
2. Exécutez le script (PowerShell) :

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
   ```

   Ou manuellement :

   ```bash
   git init
   git branch -M main
   git add -A
   git commit -m "Initial commit: monorepo POS (backend, desktop, infra)"
   git remote add origin https://github.com/Mikelaroselouisiv/Parallele-POS-Systeme.git
   git push -u origin main
   ```

   Si `origin` existe déjà : `git remote set-url origin https://github.com/Mikelaroselouisiv/Parallele-POS-Systeme.git`

3. À l’invite, connectez-vous à GitHub (HTTPS : token personnel ; ou configurez [SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)).
