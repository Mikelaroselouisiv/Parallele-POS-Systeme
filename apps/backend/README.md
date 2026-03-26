# POS Backend (NestJS + Prisma + PostgreSQL)

Backend API modulaire pour un systeme POS professionnel.

## Stack

- NestJS
- Prisma ORM
- PostgreSQL
- JWT + Passport
- Docker / Docker Compose
- class-validator

## Modules

- `auth`: register/login, JWT
- `users`: gestion utilisateurs (`ADMIN`, `CASHIER`)
- `products`: catalogue et mise a jour des stocks
- `sales`: ventes et lignes de vente
- `inventory`: verification et decrement du stock

## Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Users (admin only)
- `GET /users`
- `GET /users/:id`

### Products
- `POST /products` (admin)
- `GET /products` (admin, cashier)
- `PATCH /products/:id` (admin)

### Sales
- `POST /sales` (admin, cashier)
- `GET /sales` (admin, cashier)

## Lancement local (sans Docker)

1. Installer Node.js (LTS) et npm
2. Installer les dependances:
   - `npm install`
3. Mettre a jour `.env` (host postgres local ex: `localhost`)
4. Generer Prisma client:
   - `npm run prisma:generate`
5. Appliquer migration:
   - `npm run prisma:migrate`
6. Seed admin:
   - `npm run prisma:seed`
7. Lancer l'API:
   - `npm run start:dev`

## Lancement Docker

1. `docker compose -f ../../infra/docker/docker-compose.yml up --build`
2. Dans un second terminal:
   - `docker exec -it pos_backend npx prisma db seed`

## Seed admin par defaut

- email: `admin@pos.local`
- password: `admin1234`

## Notes

- Logging middleware global actif
- Validation DTO globale active
- Filtre global des exceptions HTTP
