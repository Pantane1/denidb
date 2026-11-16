# DeniBook — Tap-First Credit & Debt Ledger (PWA)

Mobile-first Progressive Web App for small business owners to log single or split credit sales in under 3 seconds, track partial/full repayments, and send one-tap WhatsApp balance reminders.

## Features

- **Quick-Sale Tap Engine**: Tap 1 customer for a single sale or 2+ customers for automatic Split Mode. Tap any item (default: `Fert @ 50`) to increment quantity (`+1`, `-1`, `Reset`), preview split totals live, and save in one tap.
- **Offline-First Cache & Sync**: Sales and payments commit immediately to local storage so spotty mobile data never stalls a sale, automatically syncing pending operations to Supabase when online.
- **Client Ledger & Void Safeguard**: Chronological statement per customer with timestamps, item details, running balance, and confirmation-guarded voiding.
- **Quick Payments ("Lipia")**: Preset chips (`Full Balance`, `Half`, `50`, `100`, `200`, `500`) plus a large-button numeric keypad.
- **One-Click WhatsApp Reminders**: Sanitizes local phone numbers (e.g. `0712345678` -> `254712345678`) and launches `wa.me` with a customizable reminder template.
- **Owner PIN Lock & CSV Export**: Optional 4-digit PIN lock screen, customizable product catalog, light/dark high-contrast themes, and one-click CSV backup.

## Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard and run the migration script in:
   ```
   supabase/migrations/001_denibook_schema.sql
   ```
   This creates the `clients`, `products`, and `transactions` tables, Row Level Security (RLS) policies, the `sync_client_total_balance()` atomic trigger, and the `record_split_sale()` RPC function, and seeds `Fert @ 50`.
3. In **Authentication → Providers**, ensure **Email** (Magic Link) is enabled if you want cloud sync sign-in across devices.
4. Copy `.env.example` to `.env.local` and fill in your credentials from **Project Settings → API**:
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-public-key"
   ```
   *(If left unset, DeniBook runs cleanly in offline-first local storage mode.)*

## Local Development

```bash
npm install
npm run dev
```

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the project in [vercel.com](https://vercel.com) (Framework Preset: **Vite**).
3. Add environment variables in **Project Settings → Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. `vercel.json` is pre-configured for SPA routing and PWA service worker headers so users can **Add to Home Screen** on Android and iOS Safari.
