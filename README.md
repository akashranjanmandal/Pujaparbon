# Pujo Parbon · Seller OS

A simple back-office for a seller who buys stock at the market and sells on several platforms.
Built by **GOBT — Group of Blooming Technicians**.

## What it does
- **Buy**: record a market trip: items, what was paid, and every trip cost (travel, food, toll, van, labour...). The app spreads those costs over the items, shows the **real cost per piece**, and lets him set the selling price by amount, percentage or exact price, with the percentage shown live.
- **Stock**: categories are created by typing them. Update counts every day or two on one simple screen. Stock value is always in step with the ledger.
- **Platforms**: add any platform (Flipkart, Amazon, Meesho...). Upload the monthly sales report (Excel/CSV) and invoice. Unfamiliar columns are matched once and remembered; a monthly checklist shows what is missing.
- **Analytics**: profit, money in and out, platform comparison, best and worst items, categories, customer states, for any week, month or custom dates.
- **Investments**: market buys plus other investments (equipment, rent, packing...).
- **Team**: employees check in and out from their phone, inside the shop location, with a selfie; owner sees a live board and month register.
- **Reports**: Excel and PDF for everything.

Two logins only: **Owner** (everything) and **Employee** (shift).

## Stack
| Layer | Choice |
| --- | --- |
| Frontend | Next.js 15 (App Router), Tailwind CSS, Framer Motion, Recharts, Lexend font |
| Backend | Node.js, Express 5, TypeScript |
| Database | Turso (libSQL) via Drizzle ORM; a local libSQL file for offline dev |
| Shared | `packages/shared`: costing maths, date ranges, Zod schemas, roles |
| Security | Argon2id passwords, 15-minute JWT access tokens, rotating hashed refresh tokens (httpOnly cookie), role-based access, tenant isolation, login lockout and rate limit, audit log |
| Tests | Vitest + Supertest (unit and API integration), plus browser tests of the key flows |

## Run it
```bash
npm install
cp apps/api/.env.example apps/api/.env   # TURSO_DATABASE_URL + TURSO_AUTH_TOKEN, or leave blank for a local file
npm run db:setup                          # migrations + demo data
npm run dev                               # API :4000, web :3000
```
Demo logins (password `PujaParbon@2026`): `owner@pujaparbon.in` (Owner tab), `staff@pujaparbon.in` (Employee tab).
`npm run db:fresh --workspace apps/api` wipes every table and rebuilds the schema and demo data.

## Tests
```bash
npm test
```
