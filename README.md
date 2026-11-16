# MoneyMate

**From Contributions to Reconciliation.**
A collaborative platform for tracking project contributions, expenses, advances, reimbursements and resources — with source-based verification and full financial reconciliation in **BDT (৳)**.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Supabase setup](#supabase-setup)
5. [Environment variables](#environment-variables)
6. [Running the app](#running-the-app)
7. [Money model](#money-model)
8. [Data model](#data-model)
9. [Verification flows](#verification-flows)
10. [Security model](#security-model)
11. [Reports & ledger](#reports--ledger)
12. [Testing](#testing)
13. [Project structure](#project-structure)
14. [Known limitations](#known-limitations)
15. [Troubleshooting](#troubleshooting)

---

## What it does

MoneyMate is designed for teams (student productions, events, community projects, small businesses) who pool money, materials and effort — and need to know, at any moment, **where every taka went** and **who verified what**.

### Core capabilities

| Area | What you get |
|---|---|
| **Projects** | Create or join projects (by email invite or 6-character join code), with roles: `manager`, `member`, `viewer` |
| **Contributions** | Cash / sponsorship, material, physical asset, or in-kind contributions. Restricted sponsorships with **category allocations** (e.g. “৳10,000 only for equipment & transport”) enforced at the DB level |
| **Advances** | A provider hands money to a custodian (from own funds or project cash); spending against the advance is tracked and verified |
| **Expenses** | Record an expense from three sources — *advance money*, *personal money* (→ reimbursement claim) or *project cash in hand* — with a **camera receipt photo** upload |
| **Verification** | Immutable audit trail of every verify / reject / clarification action, with snapshots (amount, verifier name, notes). **No self-verification** — enforced in RPCs and RLS |
| **Reimbursements** | Personal-money claims become reimbursement records; partial and full settlements are tracked per payment |
| **Resources** | Material / asset / access tracking with a full movement log (proposed → committed → available → assigned → in use → returned) |
| **Ledger** | Immutable `financial_ledger_entries` written by the same RPCs that move money — two buckets (`main` = project cash, `custody` = money held by custodians) |
| **Dashboard** | Live project summary (contributions, advances, spending, reimbursements, available cash), category breakdown and trend charts |
| **Reports** | CSV exports: transactions, contributions, advances, expenses, reimbursements, resources — plus the full ledger table |
| **Notifications** | In-app notification center (verification requests, payments, invitations, resource assignments…) |
| **Dark mode** | Light/dark theme toggle in the header; follows the system preference by default, choice persists across sessions, no flash on load |
| **Mobile-first** | Responsive layout with bottom navigation on small screens and `capture="environment"` camera input for receipts |

---

## Tech stack

- **Frontend:** React 18 (JavaScript/JSX — no TypeScript), Vite 6, React Router 6, Tailwind CSS 3, Lucide icons, React Hook Form + Zod, Recharts, date-fns, react-hot-toast
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Row Level Security). All multi-step financial operations run as `SECURITY DEFINER` RPCs inside Postgres
- **Tests:** Vitest (unit tests for money math & business rules) + a raw SQL smoke test for the database layer

---

## Quick start

```bash
# 1. install dependencies
npm install

# 2. configure Supabase (see next section), then create .env
cp .env.example .env
#   → paste your project URL and anon key into .env

# 3. run
npm run dev
```

Prerequisites:

- **Node.js** ≥ 18 (developed on Node 26)
- **A Supabase project** — the intended one is `wuwxnulvrrjewuygneer` (create a free project at [supabase.com](https://supabase.com) if you don't have it)

> If `.env` is missing/empty the app still boots, but shows a **setup screen** explaining exactly what to configure instead of failing silently.

---

## Supabase setup

### 1. Apply the database migrations

All schema, business logic, RLS and storage are plain SQL in `supabase/migrations/`, numbered and **dependent on execution order**:

| Order | File | Contents |
|---|---|---|
| 1 | `0001_core_schema.sql` | Enums, all 17 tables, indexes, FKs, triggers for `updated_at` and profile snapshots |
| 2 | `0002_business_logic.sql` | SECURITY DEFINER RPCs (advance/verify/settle/allocation/join logic), balance- & allocation-checking triggers, immutable ledger writes, notifications |
| 3 | `0003_rls_security.sql` | Row Level Security policies on **every** table + profile guards + hard-delete protections |
| 4 | `0004_storage_receipts.sql` | Private `receipts` bucket (10 MB, images + PDF) with path-scoped policies |
| 5 | `0005_storage_project_images.sql` | Public `project-images` bucket (5 MB) for project logos |
| 6 | `0006_function_hardening.sql` | `search_path` pinning on all SECURITY DEFINER functions, restricted EXECUTE grants |
| 7 | `0007_hardening_and_performance.sql` | RLS/initplan rewrites for policy performance, FK indexes, extra storage policies |
| 8 | `0008_verify_guard_fixes.sql` | Verification-order fixes: submitter check first; manager-recorder may verify external-sponsor contributions |
| 9 | `0009_fix_settlement_enum_cast.sql` | `mm_settle_reimbursement` status CASE cast to `reimbursement_status` |
| 10 | `0010_cascade_safe_guards.sql` | Guards allow `pg_trigger_depth() > 1` cascades; contribution DELETE guard returns OLD |
| 11 | `0011_fix_projects_select_policy_owner.sql` | Project owners can SELECT their own project (fixes the `insert().select()` RLS error on project creation) |
| 12 | `0012_add_project_id_to_allocations_view.sql` | Adds `project_id` to the `allocations_with_balance` view |
| 13 | `0013_fix_notification_links.sql` | Notification deep links stored as `/app/projects/...` (rewrites `mm_notify` + repairs existing rows) — fixes 404s when tapping notifications |
| 14 | `0014_fix_advance_spend_notification.sql` | Spending from an advance without a third-party provider (project-cash funded / provider = submitter) no longer crashes on a NULL notification user; managers verify those expenses as fallback |

**To apply via the Supabase dashboard:**

1. Open your project → **SQL Editor** → *New query*.
2. Copy the **entire contents** of `0001_core_schema.sql`, paste, **Run**.
3. Repeat for `0002` … `0014` — **in that order, one at a time**.
4. Confirm: **Table Editor** shows 17 tables, **Storage** shows the `receipts` and `project-images` buckets.

*(If you use the Supabase CLI instead: `supabase db push` from this folder — the files are CLI-compatible migration format.)*

### 2. Check Auth settings

- **Authentication → Providers → Email**: enabled (default).
- If you don't want email confirmation during local testing: **Authentication → Settings → Email** → turn *Confirm email* **off** (users otherwise need to click the confirmation link before signing in).
- Recommended: **Authentication → Settings** → enable **Leaked password protection** (rejects passwords known to have been breached).
- Site URL / redirect: add `http://localhost:5173/**` to **redirect URLs** while developing.

### 3. Grab the API credentials

**Project Settings → API**:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

> The anon key is safe for frontend use — RLS is the real gate. **Never** place the `service_role` key in this project or any frontend code.

Storage buckets are created by migrations 4 & 5 — no manual bucket setup needed.

---

## Environment variables

`.env` (copy from `.env.example`):

```ini
VITE_SUPABASE_URL=https://wuwxnulvrrjewuygneer.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # your project's anon key
```

Only these two variables are read (`src/lib/supabase.js`). `VITE_` variables are **public by design** — this project intentionally contains no secrets in the client.

---

## Running the app

```bash
npm run dev        # dev server → http://localhost:5173
npm run build      # production build → dist/ (code-split: app + vendor + charts)
npm run preview    # serve the production build locally
npm test           # Vitest unit tests, run once
npm run test:watch # Vitest in watch mode
```

---

## Money model

All monetary amounts are stored as **integer poisha** (1 BDT = 100 poisha). There is **no floating-point money math anywhere** in the app or database.

- UI input: users type `450.50` → stored as `45050`.
- Display: `formatBDT(45050)` → `৳450.50` (`src/utils/money.js`).
- Formulas (all integer):

```
available_cash =
      verified cash contributions
    + advances funded from own_funds
    − verified advance-sourced spending
    − verified project_cash-sourced spending
    − reimbursements paid
```

Non-cash contributions (material / asset / in-kind) **never** enter the cash ledger.

---

## Data model

17 tables (see `0001_core_schema.sql`):

| Group | Tables |
|---|---|
| Identity & membership | `profiles`, `projects`, `project_members`, `project_invitations` |
| Money in | `contributions`, `contribution_allocations` |
| Money out | `advances`, `expenses`, `reimbursements`, `reimbursement_payments` |
| Physical | `project_resources`, `resource_movements` |
| Trust & audit | `transaction_attachments`, `verification_events`, `financial_ledger_entries`, `notifications`, `audit_logs` |

Key RPCs (see `0002_business_logic.sql`) — all financial mutations go through these, never direct table writes:

| RPC | Purpose |
|---|---|
| `mm_create_advance`, `mm_confirm_advance` | Issue/confirm an advance; writes custody ledger entry |
| `mm_verify_expense`, `mm_verify_contribution` | Verify/reject with immutability + **no self-verification** checks |
| `mm_settle_reimbursement` | Partial/full settlement; auto-closes when fully paid |
| `mm_set_allocations` | Replace a contribution's category allocation set atomically |
| `mm_invite_member`, `mm_accept_invitation`, `mm_join_by_code` | Membership flows |
| `mm_project_summary` | One-call dashboard aggregation |
| `mm_update_resource`, resource movement RPCs | Resource lifecycle |
| `mm_notify`, `mm_audit` | Internal helpers for notifications/audit |
| `mm_storage_uploader_path`, `mm_storage_project_path` | Storage path helpers used by bucket RLS |

Integrity is additionally enforced by **triggers**: expense inserts validate remaining advance balance and matching allocation category/remaining; contributions are immutable after verification; ledger entries and verification events are append-only.

---

## Verification flows

MoneyMate implements two verification scenarios:

**Scenario A — Source verification (money from an advance).**
A custodian spends the money a provider gave them. The **money provider** (the person who handed over the advance) verifies each purchase against receipts. The provider cannot verify their own spending, and the spender cannot verify their own expense.

**Scenario B — Manager verification (personal money claim).**
A member pays from their own pocket and records the expense as `personal`. A **project manager** verifies it; verified claims become outstanding reimbursements that managers settle from project cash.

Every action (`verified` / `rejected` / `clarification`) writes an immutable row to `verification_events` with amount and verifier-name snapshots, so history survives even if an account is later deleted (profile deletes are `SET NULL`, not cascades).

---

## Security model

- **RLS on every table** (`0003_rls_security.sql`): members see only their projects' rows; `manager` role gates verification, settlement, membership and settings operations; viewers are read-only.
- **All financial mutations are `SECURITY DEFINER` RPCs** with explicit permission checks inside — the client cannot bypass balance, allocation or self-verification rules.
- **No self-verification**: DB-checked; a user can never verify a transaction they created or funded with money they control in the conflicting role.
- **Immutable audit**: `verification_events`, `financial_ledger_entries`, `audit_logs` are insert-only for everyone; updates/deletes are blocked.
- **Storage**: receipts live in a **private** bucket under `{project_id}/{user_id}/{type}/{tx_id}/{file}`; read access is project-membership-checked via `mm_storage_uploader_path` / `mm_storage_project_path`. Project images are in a public bucket (they're logos/showcase images by design).
- **Account deletion safety**: financial history is preserved with name snapshots rather than orphaned or destroyed.

---

## Reports & ledger

Under a project's **Reports** tab:

- CSV exports: all transactions, contributions, advances, expenses, reimbursements, resources
- Ledger table: chronological, append-only movement of cash between `main` (project) and `custody` (custodian) buckets with running context

Reports are generated client-side from project-scoped queries — no server-side export job needed.

---

## Testing

**Unit tests (Vitest — `npm test`):** 31 tests across 3 files.

- `tests/money.test.js` — poisha conversion, formatting, rounding safety
- `tests/business-rules.test.js` — cash formula, allocation remaining math, reimbursement status transitions, advance balance logic
- `tests/services.test.js` — service-layer payload shaping and guard rails

**SQL smoke test (`tests/sql/business_logic_smoke_test.sql`):** end-to-end database validation meant to be pasted into the Supabase SQL Editor after migrations. It exercises:

1. advance issue → spend → balance enforcement
2. self-verification rejection → correct-party verification
3. personal-money claim → partial + full reimbursement settlement
4. restricted allocation overspend & category-mismatch rejection
5. RLS invisibility checks (non-members must see nothing)

It cleans up its `@mm-test.local` test users afterwards.

> **Note:** the SQL smoke test has been executed end-to-end against the live project (all 8 scenarios pass) and cleans up its own test data. Run it any time after migrations to re-validate the database layer.

---

## Project structure

```
moneymate/
├── index.html
├── package.json
├── vite.config.js          # dev + build (manualChunks) + vitest config
├── tailwind.config.js
├── .env.example
├── supabase/
│   └── migrations/         # 0001 … 0014 — apply in order
├── tests/                  # Vitest unit tests + tests/sql/ smoke test
└── src/
    ├── main.jsx / App.jsx  # routing (public, auth, app, project tabs)
    ├── constants/          # categories, statuses, notification kinds
    ├── lib/                # supabase client + isSupabaseConfigured
    ├── utils/              # money (poisha) + format helpers
    ├── schemas/            # zod validation schemas
    ├── contexts/           # AuthContext
    ├── hooks/              # useProjects, useProject (ProjectProvider)
    ├── services/           # api, auth, projects, contributions, advances,
    │                       # expenses, reimbursements, resources,
    │                       # notifications, storage, ledger
    ├── components/         # ui primitives, forms, layout, tx cards,
    │                       # verification panel, upload (camera capture)
    └── pages/
        ├── public/         # landing
        ├── auth/           # login, signup, forgot, reset
        ├── app/            # dashboard, projects, notifications, profile, admin
        └── project/        # overview, transactions, contributions, advances,
                            # resources, verification, reimbursements,
                            # members, reports, settings + new/detail pages
```

---

## Known limitations

- **No labor valuation** — work/time is not priced or tracked as money.
- **No bank/bKash execution** — payment *method* is recorded (`cash`, `bkash`, `nagad`, `bank`, `other`), but MoneyMate never moves money itself.
- **No double-entry accounting** — ledger buckets (`main`/`custody`) are purpose-built for this domain, not a general journal.
- Single currency per project (`BDT` default); no multi-currency conversion.
- Email templates are Supabase defaults; branding them is done in the Supabase dashboard.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows a setup/“supabaseUrl is required” screen | `.env` missing or empty — fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, restart `npm run dev` |
| Login says “Email not confirmed” | Supabase → Authentication → Settings → disable *Confirm email* (dev), or click the emailed link |
| “Permission denied” / empty data | Migrations not applied in order, esp. `0003_rls_security.sql` |
| Receipt upload fails | Bucket `receipts` missing → run `0004_storage_receipts.sql`; also check file ≤ 10 MB and type jpeg/png/webp/pdf |
| RPC errors like `function mm_verify_expense does not exist` | `0002_business_logic.sql` wasn't applied (or was applied before `0001`) |
| Charts/other pages blank after build | Hard-refresh; dist/ is code-split — stale chunks can persist in dev caches |

---

*MoneyMate v2.2 — built for teams who want receipts, not arguments.*
