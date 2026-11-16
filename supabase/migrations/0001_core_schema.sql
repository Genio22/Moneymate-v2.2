-- =====================================================================
-- MoneyMate 0001 — Core schema
-- Money is stored as INTEGER POISHA (1 BDT = 100 poisha). No floats.
-- Currency is stored explicitly (default 'BDT').
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type project_status as enum ('draft','active','on_hold','completed','archived');
create type member_role as enum ('manager','member','viewer');
create type contribution_type as enum ('cash','material','asset','in_kind');
create type contribution_status as enum ('pending','verified','rejected');
create type ownership_status as enum ('contributor_retained','transferred','undetermined');
create type advance_status as enum ('active','closed','rejected');
create type advance_funding as enum ('own_funds','project_cash');
create type expense_status as enum ('pending','verified','rejected','clarification');
create type expense_source as enum ('advance','personal','project_cash');
create type verification_action as enum ('verified','rejected','clarification');
create type reimbursement_status as enum ('outstanding','partially_reimbursed','fully_reimbursed');
create type attachment_tx_type as enum ('expense','contribution');
create type resource_status as enum ('proposed','committed','available','assigned','in_use','returned','unavailable');
create type resource_type as enum ('material','asset','access','other');
create type ledger_bucket as enum ('main','custody');
create type ledger_kind as enum ('cash_contribution','advance_issue','advance_transfer','advance_spend','expense_project_cash','reimbursement_payment','adjustment');
create type invitation_status as enum ('pending','accepted','revoked','expired');

-- ---------------------------------------------------------------- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_system_admin boolean not null default false,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  image_url text,
  category text,
  status project_status not null default 'active',
  start_date date,
  expected_end_date date,
  initial_budget bigint check (initial_budget >= 0),
  currency text not null default 'BDT' check (currency = 'BDT'), -- initial locale: BDT only
  owner_id uuid not null references profiles(id) on delete cascade,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text,'-',''), 1, 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- project_members
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_user_idx on project_members(user_id);

-- ---------------------------------------------------------------- project_invitations
create table project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  role member_role not null default 'member',
  invited_by uuid not null references profiles(id) on delete cascade,
  status invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique (project_id, email)
);

-- ---------------------------------------------------------------- contributions
-- Cash contributions: amount_poisha = money received.
-- Non-cash contributions: amount_poisha = the agreed (manually entered) value.
-- A non-cash contribution NEVER increases the project's available cash.
create table contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contribution_type contribution_type not null,
  contributor_user_id uuid references profiles(id) on delete set null,
  contributor_name text not null,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  amount_poisha bigint not null check (amount_poisha >= 0),
  currency text not null default 'BDT' check (currency = 'BDT'),
  restricted boolean not null default false,
  received_on date not null default current_date,
  ownership_status ownership_status not null default 'contributor_retained',
  usage_start date,
  usage_end date,
  usage_conditions text,
  location text,
  quantity numeric(14,3) not null default 1,
  unit text,
  status contribution_status not null default 'pending',
  recorded_by uuid references profiles(id) on delete set null,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contributions_pending_unverified
    check ( (status = 'pending' and verified_by is null and verified_at is null)
         or (status <> 'pending') )
);
create index contributions_project_idx on contributions(project_id);
create index contributions_status_idx on contributions(project_id, status);

-- ---------------------------------------------------------------- contribution_allocations
-- Unified restrictions + allocations model: each row earmarks part of a
-- contribution's amount for one permitted spending category.
-- Unrestricted portion of a contribution = amount - sum(allocations).
-- (Documented assumption: `contribution_restrictions` and
--  `contribution_allocations` are unified into this one table.)
create table contribution_allocations (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references contributions(id) on delete cascade,
  category text not null check (char_length(category) between 2 and 60),
  amount_poisha bigint not null check (amount_poisha > 0),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index contribution_allocations_contribution_idx on contribution_allocations(contribution_id);

-- ---------------------------------------------------------------- advances
-- Money handed from a provider to a custodian for future spending.
-- An advance is NOT an expense.
create table advances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reference text not null unique,
  provider_user_id uuid references profiles(id) on delete set null,
  provider_name text not null,
  custodian_id uuid references profiles(id) on delete set null,
  amount_poisha bigint not null check (amount_poisha > 0),
  currency text not null default 'BDT' check (currency = 'BDT'),
  funding_source advance_funding not null default 'own_funds',
  purpose text,
  provided_on date not null default current_date,
  status advance_status not null default 'active',
  custodian_confirmed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index advances_project_idx on advances(project_id);
create index advances_custodian_idx on advances(project_id, custodian_id, status);

-- ---------------------------------------------------------------- expenses
-- A purchase. funding_source:
--   advance      -> paid from money handed to the payer (advance_id required,
--                   verified by the advance provider = source verification)
--   personal     -> payer's own money (a reimbursement claim, verified by manager)
--   project_cash -> paid from project cash held by the payer (verified by manager)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reference text not null unique,
  title text not null check (char_length(title) between 2 and 200),
  description text,
  amount_poisha bigint not null check (amount_poisha > 0),
  currency text not null default 'BDT' check (currency = 'BDT'),
  category text not null default 'misc',
  vendor text,
  quantity numeric(14,3) not null default 1,
  unit text,
  purchased_on date not null default current_date,
  paid_by uuid references profiles(id) on delete set null,
  funding_source expense_source not null default 'personal',
  advance_id uuid references advances(id) on delete set null,
  contribution_allocation_id uuid references contribution_allocations(id) on delete set null,
  restriction_exception boolean not null default false,
  status expense_status not null default 'pending',
  source_provider_id uuid references profiles(id),   -- who must verify (denormalized)
  verification_type text not null check (verification_type in ('source','manager')),
  notes text,
  created_by uuid references profiles(id) on delete set null,
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_advance_source
    check ( (funding_source = 'advance' and advance_id is not null)
         or (funding_source <> 'advance' and advance_id is null) ),
  constraint expenses_pending_unverified
    check ( (status in ('pending','clarification') and verified_by is null and verified_at is null)
         or (status = 'verified')
         or (status = 'rejected') )
);
create index expenses_project_idx on expenses(project_id);
create index expenses_status_idx on expenses(project_id, status);
create index expenses_advance_idx on expenses(advance_id);
create index expenses_alloc_idx on expenses(contribution_allocation_id);
create index expenses_provider_idx on expenses(project_id, source_provider_id, status);

-- ---------------------------------------------------------------- reimbursements
-- Created ONLY when a personal expense is verified.
-- Verification != reimbursement: settlement is tracked separately.
create table reimbursements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  payee_id uuid references profiles(id) on delete set null,
  amount_poisha bigint not null check (amount_poisha > 0),
  outstanding_poisha bigint not null check (outstanding_poisha >= 0),
  status reimbursement_status not null default 'outstanding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expense_id)
);
create index reimbursements_payee_idx on reimbursements(project_id, payee_id, status);

create table reimbursement_payments (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references reimbursements(id) on delete cascade,
  amount_poisha bigint not null check (amount_poisha > 0),
  paid_on date not null default current_date,
  method text not null default 'cash',
  reference text,
  notes text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reimbursement_payments_rb_idx on reimbursement_payments(reimbursement_id);

-- ---------------------------------------------------------------- project_resources
create table project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  resource_type resource_type not null default 'material',
  description text,
  source_contribution_id uuid references contributions(id) on delete set null,
  owner_user_id uuid references profiles(id) on delete set null,
  owner_name text not null,
  ownership_status ownership_status not null default 'contributor_retained',
  quantity numeric(14,3) not null default 1,
  unit text,
  agreed_value_poisha bigint check (agreed_value_poisha >= 0),
  custodian_id uuid references profiles(id) on delete set null,
  location text,
  status resource_status not null default 'proposed',
  returnable boolean not null default true,
  usage_start date,
  usage_end date,
  usage_conditions text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_resources_project_idx on project_resources(project_id);
create index project_resources_status_idx on project_resources(project_id, status);

create table resource_movements (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references project_resources(id) on delete cascade,
  status_to resource_status not null,
  custodian_id uuid references profiles(id) on delete set null,
  custodian_name text,
  location text,
  note text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index resource_movements_resource_idx on resource_movements(resource_id);

-- ---------------------------------------------------------------- attachments
-- Receipts & evidence. storage_path points INTO the private `receipts`
-- bucket using the convention: {project_id}/{user_id}/{filename}
create table transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_type attachment_tx_type not null,
  transaction_id uuid not null,
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index transaction_attachments_tx_idx on transaction_attachments(transaction_type, transaction_id);

-- ---------------------------------------------------------------- verification events (immutable)
create table verification_events (
  id uuid primary key default gen_random_uuid(),
  transaction_type attachment_tx_type not null,
  transaction_id uuid not null,
  verifier_id uuid references profiles(id) on delete set null,
  verifier_name text not null default '', -- snapshot survives account deletion
  action verification_action not null,
  previous_status text not null,
  new_status text not null,
  comment text,
  created_at timestamptz not null default now()
);
create index verification_events_tx_idx on verification_events(transaction_type, transaction_id);

-- ---------------------------------------------------------------- ledger (append-only)
create table financial_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  entry_kind ledger_kind not null,
  bucket ledger_bucket not null default 'main',
  amount_poisha bigint not null check (amount_poisha <> 0), -- signed: + in / - out
  description text,
  ref_type text,
  ref_id uuid,
  actor_id uuid references profiles(id),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index ledger_project_idx on financial_ledger_entries(project_id, entry_date);
create index ledger_ref_idx on financial_ledger_entries(ref_type, ref_id);

-- ---------------------------------------------------------------- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, read, created_at desc);

-- ---------------------------------------------------------------- audit logs
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers: updated_at
create or replace function mm_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','projects','contributions','advances','expenses',
    'reimbursements','project_resources','project_invitations'] loop
    execute format('create trigger trg_%s_touch before update on %I
                    for each row execute function mm_touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- helpers: new user -> profile
create or replace function mm_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function mm_handle_new_user();

-- ---------------------------------------------------------------- helpers: project owner becomes member
create or replace function mm_owner_becomes_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'manager')
  on conflict do nothing;
  return new;
end $$;

create trigger trg_project_owner_member
after insert on projects
for each row execute function mm_owner_becomes_member();

-- ---------------------------------------------------------------- helpers: human references
create or replace function mm_gen_reference(prefix text) returns text
language plpgsql as $$
declare d text;
begin
  d := to_char(now() at time zone 'Asia/Dhaka', 'YYMMDD');
  return prefix || '-' || d || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
end $$;

create or replace function mm_expense_ref() returns trigger
language plpgsql as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := mm_gen_reference('EXP');
  end if;
  return new;
end $$;

create or replace function mm_advance_ref() returns trigger
language plpgsql as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := mm_gen_reference('ADV');
  end if;
  return new;
end $$;

create trigger trg_expense_ref before insert on expenses
for each row execute function mm_expense_ref();
create trigger trg_advance_ref before insert on advances
for each row execute function mm_advance_ref();
