# Hikma Billetterie Transport — 20 ans

Plateforme de réservation et de paiement du transport en bus pour la célébration des 20 ans de Hikma (Dakar Arena, Diamniadio).

## Structure

```
hikma-billetterie/
├── frontend/   Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui
├── backend/    Node.js 20 + Express + Prisma + PostgreSQL
└── README.md
```

## Prérequis

- Node.js 20+ LTS
- npm 10+
- PostgreSQL (local ou hébergé)

## Installation

```cmd
cd frontend
npm install

cd ..\backend
npm install
```

## Variables d'environnement

### Backend — `backend/.env`

| Variable | Description |
|---|---|
| `DATABASE_URL` | URL PostgreSQL (pooler) |
| `DIRECT_URL` | URL PostgreSQL directe (migrations) |
| `PORT` | Port du serveur (défaut : 4000) |
| `NODE_ENV` | `development` ou `production` |
| `FRONTEND_URL` | URL du frontend (CORS) |
| `JWT_SECRET` | Secret JWT (long, aléatoire) |
| `JWT_EXPIRES_IN` | Durée du token (ex. `12h`) |
| `ADMIN_USERNAME` | Identifiant du premier compte admin (seed) |
| `ADMIN_PASSWORD` | Mot de passe du premier compte admin (seed) |
| `PAYMENT_MODE` | `mock` (dev) ou `live` (prod) |
| `BICTORYS_API_URL` | URL API Bictorys |
| `BICTORYS_API_KEY` | Clé API Bictorys |
| `BICTORYS_WEBHOOK_SECRET` | Secret webhook Bictorys |

### Frontend — `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de l'API backend (ex. `http://localhost:4000/api`) |

## Lancement local (mode mock)

```cmd
REM Terminal 1 — Backend
cd backend
copy .env.example .env
REM Éditer .env avec vos valeurs
npm run db:migrate
set NODE_ENV=development && npm run db:seed
npm run dev

REM Terminal 2 — Frontend
cd frontend
copy .env.example .env
npm run dev
```

- Frontend : http://localhost:3000
- Backend : http://localhost:4000
- Health check : http://localhost:4000/api/health

## Parcours utilisateur (mode mock)

1. http://localhost:3000 → choisir une zone → remplir le formulaire → « Continuer vers le paiement »
2. Page mock-payment → « Paiement réussi »
3. Page confirmation → billet affiché avec QR code
4. Télécharger le PDF ou partager sur WhatsApp

## Espace admin

- URL : http://localhost:3000/admin
- Identifiant : valeur de `ADMIN_USERNAME` dans `.env` (défaut seed : `admin`)
- Mot de passe : valeur de `ADMIN_PASSWORD` (défaut seed : `hikma2025dev`)

## Scripts disponibles

### Backend

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (tsx watch) |
| `npm run build` | Compilation TypeScript |
| `npm start` | Démarrage production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests vitest |
| `npm run db:migrate` | Applique les migrations Prisma |
| `npm run db:seed` | Données de démonstration (dev uniquement) |

### Frontend

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |

## Déploiement

### Frontend → Vercel

1. Connecter le dépôt GitHub à Vercel
2. Répertoire racine : `frontend`
3. Commande de build : `npm run build`
4. Répertoire de sortie : `dist`
5. Variable d'environnement : `VITE_API_URL` → URL du backend Render (ex. `https://hikma-backend.onrender.com/api`)

### Backend → Render

1. Nouveau service Web, répertoire racine : `backend`
2. Commande de build : `npm install && npm run build && npm run db:migrate`
3. Commande de démarrage : `npm start`
4. Variables d'environnement : toutes celles de `backend/.env.example`
5. `NODE_ENV=production`, `PAYMENT_MODE=live` (ou `mock` pour les tests)

### Base de données

Toute base PostgreSQL hébergée convient : Render Postgres, Supabase, Neon.  
Renseigner `DATABASE_URL` et `DIRECT_URL` dans les variables du service backend.

### Checklist avant mise en production

- [ ] `JWT_SECRET` long et aléatoire (min. 64 caractères)
- [ ] `ADMIN_PASSWORD` fort
- [ ] `PAYMENT_MODE=live` avec vraies clés Bictorys
- [ ] `BICTORYS_WEBHOOK_SECRET` configuré et identique côté Bictorys
- [ ] `FRONTEND_URL` pointe vers le domaine Vercel
- [ ] `NODE_ENV=production`
- [ ] Base PostgreSQL en production (pas le pool de dev)
