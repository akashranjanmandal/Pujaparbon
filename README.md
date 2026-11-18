# Pujo Parbon · Seller OS

Warehouse, multi-marketplace orders, GST billing and team management for **Pujo Parbon** (Sarisha, West Bengal).
Built by **GOBT — Group of Blooming Technicians**.

## Stack
| Layer | Choice |
| --- | --- |
| Frontend | Next.js 15 (App Router), Tailwind CSS, Framer Motion, Recharts |
| Backend | Node.js, Express 5, TypeScript |
| Database | Turso (libSQL) via Drizzle ORM — local libSQL file for offline dev |
| Shared | `packages/shared`: Zod schemas, roles & permissions, GST / payroll / geofence rules |
| Security | Argon2id passwords, 15-min JWT access tokens, rotating hashed refresh tokens (httpOnly cookie), RBAC, tenant isolation, rate-limited login with lockout, Helmet, audit log |
| Tests | Vitest + Supertest (unit + API integration) |

## Run it
```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, or leave blank for local file
npm run db:setup                          # migrations + demo data
npm run dev                               # API :4000, web :3000
```
Demo logins (password `PujaParbon@2026`): `owner@pujaparbon.in`, `manager@pujaparbon.in`, `staff@pujaparbon.in`.

## Tests
```bash
npm test
```

## Modules
Dashboard · Analytics & P&L · Products/SKUs with marketplace mapping & barcode labels · Stock ledger with bins ·
Suppliers & purchases · Marketplace order import (Flipkart, Amazon, Myntra, Meesho, Ajio) · Dispatch board ·
Returns · Settlement reconciliation · GST billing · Expenses · Team, tasks, geofenced selfie attendance, leave, payroll ·
Reports (Excel/PDF) · Settings & users.
