-- Moss schema. Single-user app, but every table carries user_id + RLS
-- so it stays private today and multi-tenant-safe if that ever changes.

create extension if not exists pgcrypto;

-- ============================================================
-- settings
-- ============================================================
create table if not exists settings (
  user_id uuid primary key references auth.users on delete cascade,
  bank text default 'Generic',
  biz_shift text default 'next',          -- 'none' | 'prior' | 'next'
  cash_app_card_id uuid,                   -- FK to cards (module 4), nullable
  gemini_key_set boolean default false,    -- flag only; real key lives in Supabase Vault
  market_key_set boolean default false,
  created_at timestamptz default now()
);

alter table settings enable row level security;
drop policy if exists "settings_owner" on settings;
create policy "settings_owner" on settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- accounts
-- ============================================================
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  type text not null,        -- Cash|HSA|Roth IRA|Traditional IRA|Taxable Brokerage|Liabilities
  balance numeric(12,2) default 0,
  is_system boolean default false,   -- true = fed by paycheck contributions
  system_key text,                   -- e.g. 'hsa','t401k'; matches deductions.target_account_key
  created_at timestamptz default now()
);

alter table accounts enable row level security;
drop policy if exists "accounts_owner" on accounts;
create policy "accounts_owner" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists accounts_user_idx on accounts (user_id);

-- ============================================================
-- holdings
-- ============================================================
create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references accounts on delete cascade,   -- which brokerage/retirement acct it sits in
  symbol text not null,
  qty numeric(14,4) default 0,
  cost_basis numeric(12,4) default 0,    -- per share
  current_price numeric(12,4) default 0, -- updated by market API (module: market)
  buy_date date,
  created_at timestamptz default now()
);

alter table holdings enable row level security;
drop policy if exists "holdings_owner" on holdings;
create policy "holdings_owner" on holdings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists holdings_user_idx on holdings (user_id);
create index if not exists holdings_account_idx on holdings (account_id);

-- ============================================================
-- income_sources
-- ============================================================
create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  net_per_check numeric(12,2) default 0,
  freq text default 'biweekly',          -- 'biweekly' | 'semimonthly'
  anchor_date date,                      -- biweekly anchor payday
  sm_day1 int default 1,
  sm_day2 int default 16,
  state text,
  created_at timestamptz default now()
);

alter table income_sources enable row level security;
drop policy if exists "income_sources_owner" on income_sources;
create policy "income_sources_owner" on income_sources
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists income_sources_user_idx on income_sources (user_id);

-- ============================================================
-- deductions
-- ============================================================
create table if not exists deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  income_source_id uuid references income_sources on delete cascade,
  name text not null,
  amount numeric(12,2) default 0,        -- contribution per check
  employer_match numeric(12,2) default 0,
  target_account_key text,               -- matches accounts.system_key; null = no posting
  created_at timestamptz default now()
);

alter table deductions enable row level security;
drop policy if exists "deductions_owner" on deductions;
create policy "deductions_owner" on deductions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists deductions_user_idx on deductions (user_id);
create index if not exists deductions_income_source_idx on deductions (income_source_id);

-- ============================================================
-- categories
-- ============================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table categories enable row level security;
drop policy if exists "categories_owner" on categories;
create policy "categories_owner" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists categories_user_idx on categories (user_id);

-- ============================================================
-- recurring_items
-- ============================================================
create table if not exists recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category_id uuid references categories,
  amount numeric(12,2) default 0,        -- current default ("edit going forward" changes this)
  is_variable boolean default false,
  day_of_month int default 1,
  interval_type text default 'dom',      -- 'dom' now; 'days'/'weeks' reserved for v2
  active boolean default true,
  created_at timestamptz default now()
);

alter table recurring_items enable row level security;
drop policy if exists "recurring_items_owner" on recurring_items;
create policy "recurring_items_owner" on recurring_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists recurring_items_user_idx on recurring_items (user_id);
create index if not exists recurring_items_category_idx on recurring_items (category_id);

-- ============================================================
-- recurring_occurrences
-- Per-occurrence state: skips, one-time overrides, posted flags, actuals.
-- Keyed by the occurrence date so history is preserved.
-- ============================================================
create table if not exists recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  recurring_item_id uuid references recurring_items on delete cascade,
  occ_date date not null,
  skipped boolean default false,
  override_amount numeric(12,2),         -- one-time "edit this occurrence"
  posted boolean default false,
  actual_amount numeric(12,2),           -- entered at post time for variable bills
  created_at timestamptz default now(),
  unique (recurring_item_id, occ_date)
);

alter table recurring_occurrences enable row level security;
drop policy if exists "recurring_occurrences_owner" on recurring_occurrences;
create policy "recurring_occurrences_owner" on recurring_occurrences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists recurring_occurrences_user_idx on recurring_occurrences (user_id);
create index if not exists recurring_occurrences_item_idx on recurring_occurrences (recurring_item_id);

-- ============================================================
-- purchases (play-money spending log)
-- ============================================================
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  amount numeric(12,2) not null,
  spent_on date not null,
  category text default 'Play',
  created_at timestamptz default now()
);

alter table purchases enable row level security;
drop policy if exists "purchases_owner" on purchases;
create policy "purchases_owner" on purchases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists purchases_user_idx on purchases (user_id);
create index if not exists purchases_spent_on_idx on purchases (spent_on);

-- ============================================================
-- pay_periods (history snapshot; see build brief §3)
-- ============================================================
create table if not exists pay_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  income_source_id uuid references income_sources,
  pay_date date not null,
  window_start date not null,
  window_end date not null,
  net_income numeric(12,2),
  rollover_in numeric(12,2),
  earmarked_total numeric(12,2),
  auto_reserved numeric(12,2),
  purchases_total numeric(12,2),
  safe_to_spend numeric(12,2),
  closed boolean default false,          -- true once the window has passed & been finalized
  snapshot jsonb,                        -- frozen copy of the bills/purchases for that window
  created_at timestamptz default now(),
  unique (income_source_id, pay_date)
);

alter table pay_periods enable row level security;
drop policy if exists "pay_periods_owner" on pay_periods;
create policy "pay_periods_owner" on pay_periods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists pay_periods_user_idx on pay_periods (user_id);
create index if not exists pay_periods_closed_idx on pay_periods (user_id, closed, pay_date desc);

-- ============================================================
-- Seed a settings row automatically when a user signs up.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Design-spec additions (visual + light structural support).
-- income_sources.freq now also accepts 'weekly' | 'monthly' | 'one-off'.
-- Existing columns are reused contextually rather than adding new ones:
--   weekly   -> anchor_date is the weekly anchor (7-day steps)
--   monthly  -> sm_day1 is the day of month
--   one-off  -> anchor_date is the single date it lands on
-- ============================================================

alter table categories add column if not exists emoji text;

alter table accounts add column if not exists starting_contributed numeric(12,2) default 0;

-- Per-account daily snapshot: contributed vs market value, so the net-worth
-- history graph and per-account sparklines have real time-series data to
-- draw from. Populated lazily (upserted once per account per day) going
-- forward from whenever this ships — no fabricated pre-history.
create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references accounts on delete cascade not null,
  snapshot_date date not null,
  contributed numeric(12,2) not null,
  market_value numeric(12,2) not null,
  created_at timestamptz default now(),
  unique (account_id, snapshot_date)
);

alter table net_worth_snapshots enable row level security;
drop policy if exists "net_worth_snapshots_owner" on net_worth_snapshots;
create policy "net_worth_snapshots_owner" on net_worth_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists net_worth_snapshots_account_idx
  on net_worth_snapshots (account_id, snapshot_date);

-- ============================================================
-- Vault-backed secrets (build brief §4). The `settings` table only ever
-- holds boolean flags; the real key text lives in Supabase Vault, written
-- and read exclusively through these two functions. They run as the
-- function owner (security definer) but are only grantable to the
-- service_role — never to anon/authenticated — since vault.secrets isn't
-- itself scoped by user_id. Server route handlers call them with the
-- service-role client and always namespace the secret name with the
-- user's id.
-- ============================================================

create extension if not exists supabase_vault;

create or replace function public.set_user_secret(secret_name text, secret_value text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;
  if existing_id is not null then
    perform vault.update_secret(existing_id, secret_value);
  else
    perform vault.create_secret(secret_value, secret_name);
  end if;
end;
$$;

create or replace function public.get_user_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  result text;
begin
  select decrypted_secret into result from vault.decrypted_secrets where name = secret_name limit 1;
  return result;
end;
$$;

create or replace function public.delete_user_secret(secret_name text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where name = secret_name;
end;
$$;

revoke execute on function public.set_user_secret(text, text) from public, anon, authenticated;
revoke execute on function public.get_user_secret(text) from public, anon, authenticated;
revoke execute on function public.delete_user_secret(text) from public, anon, authenticated;
grant execute on function public.set_user_secret(text, text) to service_role;
grant execute on function public.get_user_secret(text) to service_role;
grant execute on function public.delete_user_secret(text) to service_role;

-- ============================================================
-- Module 4: cards, point multipliers, the Forbidden-Money sweep.
-- Not specified in the build brief's schema — designed to fit the existing
-- shape. Sweeps only ever touch accounts.balance (net worth); they never
-- touch purchases or the recurring engine, so Safe-to-Spend math is
-- untouched (brief §0.2).
-- ============================================================

create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  last4 text,
  network text,                          -- visa | mastercard | amex | discover, for the mock art
  color text default '#1C1A17',          -- mock card art background
  base_multiplier numeric(4,2) default 1,-- points/cashback per dollar with no category match
  created_at timestamptz default now()
);

alter table cards enable row level security;
drop policy if exists "cards_owner" on cards;
create policy "cards_owner" on cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists cards_user_idx on cards (user_id);

create table if not exists card_category_multipliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  card_id uuid references cards on delete cascade not null,
  category_id uuid references categories on delete cascade not null,
  multiplier numeric(4,2) not null,
  created_at timestamptz default now(),
  unique (card_id, category_id)
);

alter table card_category_multipliers enable row level security;
drop policy if exists "card_category_multipliers_owner" on card_category_multipliers;
create policy "card_category_multipliers_owner" on card_category_multipliers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists card_multipliers_card_idx on card_category_multipliers (card_id);

-- A credit-card charge, quarantined from Safe-to-Spend until swept.
create table if not exists card_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  card_id uuid references cards on delete cascade not null,
  category_id uuid references categories,
  name text not null,
  amount numeric(12,2) not null,
  spent_on date not null,
  swept boolean default false,
  swept_at timestamptz,
  created_at timestamptz default now()
);

alter table card_charges enable row level security;
drop policy if exists "card_charges_owner" on card_charges;
create policy "card_charges_owner" on card_charges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists card_charges_user_idx on card_charges (user_id, swept);

-- The Forbidden Money bucket is a regular account (usually a Cash App
-- balance) flagged to receive sweep totals; reconciled_balance is the last
-- real balance the user confirmed, so short-by-$X = balance - reconciled.
alter table accounts add column if not exists is_forbidden_money boolean default false;
alter table accounts add column if not exists reconciled_balance numeric(12,2);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'settings_cash_app_card_id_fkey'
  ) then
    alter table settings
      add constraint settings_cash_app_card_id_fkey
      foreign key (cash_app_card_id) references cards(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- Revision 02.
-- ============================================================

-- §7: pre-tax contributions never touched take-home in the first place, so
-- they must not be subtracted from Safe-to-Spend again — only post-tax
-- (Roth) contributions draw down money you already received. Default
-- pre_tax since 401k/HSA/Traditional IRA are the common case.
alter table deductions add column if not exists tax_treatment text default 'pre_tax';
alter table deductions drop constraint if exists deductions_tax_treatment_check;
alter table deductions add constraint deductions_tax_treatment_check
  check (tax_treatment in ('pre_tax', 'post_tax'));

-- §3: every expense now carries a payment source, which decides whether it
-- draws down Safe-to-Spend (checking, or a stored-value load) or is
-- quarantined elsewhere (rewards card -> Sweep; investing/stored-value
-- spend -> that account's own balance, no Safe-to-Spend impact).
alter table purchases add column if not exists payment_source text default 'checking';
-- (the payment_source check constraint is added once, below in §7, after
-- 'rewards_card' becomes a valid value — an intermediate narrower version
-- used to live here too, but replaying it against a live table that
-- already has rewards_card rows always fails, so it's gone.)
alter table purchases add column if not exists source_account_id uuid references accounts on delete set null;

-- §4: HYSA interest and per-account annual contribution limits (informational
-- only — Moss warns as you approach the limit, it doesn't enforce it).
alter table accounts add column if not exists apy_pct numeric(5,3);
alter table accounts add column if not exists annual_contribution_limit numeric(12,2);

-- §2.2: effective-dated amounts. A raise (or any income change) never
-- rewrites the past — it inserts a new version taking effect on a chosen
-- date. Only pay windows on/after that date resolve to the new amount;
-- closed pay-period snapshots are frozen and never recomputed regardless.
create table if not exists income_amount_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  income_source_id uuid references income_sources on delete cascade not null,
  net_per_check numeric(12,2) not null,
  effective_date date not null,
  created_at timestamptz default now(),
  unique (income_source_id, effective_date)
);

alter table income_amount_versions enable row level security;
drop policy if exists "income_amount_versions_owner" on income_amount_versions;
create policy "income_amount_versions_owner" on income_amount_versions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists income_amount_versions_source_idx
  on income_amount_versions (income_source_id, effective_date);

-- §9: "bank pays me early" — some banks post direct deposit a few days
-- ahead of the employer's stated payday. Informational/display only (see
-- expectedPayDate in src/lib/periods.ts) — it does not shift pay-period
-- window boundaries or bill filing, only the "you'll likely see it on"
-- date shown to the user.
alter table settings add column if not exists early_pay_days integer default 0;

-- ============================================================
-- Moss — Revision 03
-- ============================================================

-- §0: an explicit seeded flag, not an "is anything empty" guess — so
-- re-seeding intent is unambiguous and a partially-wiped state doesn't get
-- stuck looking permanently blank (Today re-seeds automatically if this is
-- true but income_sources comes back empty).
alter table settings add column if not exists demo_seeded boolean default false;

-- §6: custom icons on anything with a name. Falls back to the type-based
-- default emoji (accountEmoji()) when null — never prefilled.
alter table accounts add column if not exists icon text;
alter table cards add column if not exists icon text;

-- §3: liabilities get their own APR field (separate from apy_pct, which is
-- earned-interest framing for HYSA — a liability's rate costs you, it
-- doesn't pay you).
alter table accounts add column if not exists apr_pct numeric(5,3);

-- §4: Budgets — optional per-category spending caps that layer on top of
-- Safe to Spend. Keyed by category NAME (text), matching how purchases.category
-- and the "Where it goes" aggregation already key by name rather than id.
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  cap_amount numeric(12,2) not null,
  created_at timestamptz default now(),
  unique (user_id, category)
);

alter table budgets enable row level security;
drop policy if exists "budgets_owner" on budgets;
create policy "budgets_owner" on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- §2.1: hardcoded-plausible-for-demo, real-refresh-later ticker values for
-- the Today market strip (S&P/Nasdaq/Dow). Live index refresh is a follow-up
-- (true real-time costs money; even a delayed feed needs a provider that
-- serves index symbols, which free-tier Finnhub doesn't) — for now this
-- table is populated by the demo seed and is otherwise just a display read.
create table if not exists market_indices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  symbol text not null,
  label text not null,
  value numeric(12,2) not null,
  prev_close numeric(12,2) not null,
  updated_at timestamptz default now(),
  unique (user_id, symbol)
);

alter table market_indices enable row level security;
drop policy if exists "market_indices_owner" on market_indices;
create policy "market_indices_owner" on market_indices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- §0/§6: two fields the "Needs review" checklist needs that weren't
-- trackable before. min_cash is a per-account "don't let the cash sleeve
-- drop below this" line (mainly HSA — dipping under it is what usually
-- means the custodian auto-sold something to cover a charge). balance_updated_at
-- tracks when a lump (no-holdings) investable account's balance was last
-- hand-refreshed, so Moss can nudge you to update it.
alter table accounts add column if not exists min_cash numeric(12,2);
alter table accounts add column if not exists balance_updated_at timestamptz default now();

-- ============================================================
-- Moss — Revision 04
-- ============================================================

-- §2: "Alerts" rows are checkable (mark done). Nothing to persist per-alert
-- beyond a dismissal, keyed by the checklist's own deterministic id string
-- (e.g. "oversold-<account id>") — no separate alerts table needed.
create table if not exists dismissed_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  alert_id text not null,
  dismissed_at timestamptz default now(),
  unique (user_id, alert_id)
);

alter table dismissed_alerts enable row level security;
drop policy if exists "dismissed_alerts_owner" on dismissed_alerts;
create policy "dismissed_alerts_owner" on dismissed_alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- §4: Move money — a transfer between two of the user's own accounts.
-- Deliberately NOT a purchases row: a transfer must never touch net worth,
-- spending reports, budgets, or the expense ring (the money still exists,
-- just relocated). It only affects Safe to Spend when the source is
-- checking, computed the same way a checking-sourced purchase is.
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  from_account_id uuid references accounts on delete cascade not null,
  to_account_id uuid references accounts on delete cascade not null,
  amount numeric(12,2) not null,
  transfer_date date not null,
  created_at timestamptz default now()
);

alter table transfers enable row level security;
drop policy if exists "transfers_owner" on transfers;
create policy "transfers_owner" on transfers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists transfers_user_idx on transfers (user_id);
create index if not exists transfers_date_idx on transfers (transfer_date);

-- §7: Sweep rebuilt around the transaction log — a rewards-card charge is
-- now logged once, on Expenses (payment_source = 'rewards_card', with
-- which card it's on), the same as any other expense. No more separate
-- "log a card charge" entry point on Sweep — that was the double-entry
-- the revision calls out. createPurchase mirrors a rewards_card row into
-- card_charges automatically so Sweep's existing pending/reconciliation
-- plumbing keeps working unchanged.
alter table purchases add column if not exists card_id uuid references cards on delete set null;

-- Self-healing before the constraint below: normalizes any row left over
-- from an older payment-source model (or bad manual data) to 'checking' —
-- the same fallback the app itself uses for an unrecognized value
-- (see isPaymentSource() in src/lib/actions/income.ts). Without this, a
-- single stale row blocks re-running this file at all.
update purchases set payment_source = 'checking'
where payment_source not in ('checking', 'investing', 'stored_value', 'rewards_card');

alter table purchases drop constraint if exists purchases_payment_source_check;
alter table purchases add constraint purchases_payment_source_check
  check (payment_source in ('checking', 'investing', 'stored_value', 'rewards_card'));

-- ============================================================
-- Moss — Revision 05
-- ============================================================

-- §1.2/§9: no more emoji — a category's `emoji` column (kept, unrenamed,
-- to avoid a data migration) now holds either "lucide:<IconName>", a
-- data: URI (custom upload), or is left null (falls back to an initial-
-- letter circle). `color` is the category's tint, used for both the
-- symbol circle and (already) the spending ring.
alter table categories add column if not exists color text;

-- §1.1: a bill's own left-column identity — same "lucide:<Name>" / data:
-- URI / null convention as categories.emoji above.
alter table recurring_items add column if not exists icon text;

-- §4/§6: cards now live on Net worth, linked to the liability account they
-- draw against (one card per account, toggled from the account's detail
-- page) instead of Sweep's old standalone "Cards" section.
alter table cards add column if not exists account_id uuid references accounts(id) on delete set null;
create index if not exists cards_account_idx on cards (account_id);

-- ============================================================
-- Moss — Revision 06b
-- ============================================================

-- §2: the account's own last 4 (Checking/Savings/HYSA), plus a separately
-- linked debit card's last 4 (Checking/Savings/HYSA/HSA) — informational
-- display only, distinct from the `cards` table's rewards/Sweep model.
alter table accounts add column if not exists last4 text;
alter table accounts add column if not exists debit_card_last4 text;

-- §2: "holdings or lump balance" toggle for investing types — when false,
-- `balance` holds the lump sum directly and `lump_cost_basis` its total
-- cost basis, same convention as every other lump-balance type already
-- uses `balance` (HOLDINGS_TYPES membership alone used to decide this;
-- now it's membership AND this flag).
alter table accounts add column if not exists uses_holdings boolean not null default true;
alter table accounts add column if not exists lump_cost_basis numeric(12,2);

-- §4: 401(k)/403(b) employer-match modeling — "100% up to X% of salary,
-- then Y% up to Z%". Purely additive fields; employer_match still posts
-- via the linked deduction row, never touching paycheck/Safe-to-spend math.
alter table accounts add column if not exists salary numeric(12,2);
alter table accounts add column if not exists match_tier1_pct numeric(5,2);
alter table accounts add column if not exists match_tier2_limit_pct numeric(5,2);
alter table accounts add column if not exists match_tier2_rate_pct numeric(5,2);

-- §2: a Liability "is it a credit card?" toggle — when true, the account
-- becomes eligible to link a `cards` row (already the Rev 05 §4/§6
-- mechanism) and that card becomes selectable as a rewards card in Sweep.
alter table accounts add column if not exists is_credit_card boolean not null default false;

-- §7: taxes — a manual per-charge toggle. The location tax rate applies to
-- the subtotal at save time and the result is what's stored in `amount`
-- (single source of truth everywhere else already reads); this flag is
-- just the provenance record of whether that happened.
alter table purchases add column if not exists apply_tax boolean not null default false;
alter table recurring_items add column if not exists apply_tax boolean not null default false;

-- §7: one configurable location + sales-tax rate — honest scope, not
-- per-item tax rules.
alter table settings add column if not exists location text;
alter table settings add column if not exists tax_rate_pct numeric(5,3);

-- ============================================================
-- Moss — Revision 06b v2
-- ============================================================

-- §4: a liability's sub-loans — the "holdings" equivalent for debt. Every
-- liability account gets at least one row (its own balance/APR); the user
-- can add more (e.g. multiple student loans) and the account's rolled-up
-- total + blended APR are computed from these, same pattern as holdings.
create table if not exists liability_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references accounts on delete cascade not null,
  name text not null,
  balance numeric(12,2) not null default 0,
  apr_pct numeric(5,3),
  created_at timestamptz default now()
);

alter table liability_loans enable row level security;
drop policy if exists "liability_loans_owner" on liability_loans;
create policy "liability_loans_owner" on liability_loans
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists liability_loans_account_idx on liability_loans (account_id);

-- §2: an "Other" asset's free-text notes.
alter table accounts add column if not exists notes text;

-- §4: auto loan / mortgage term, in months.
alter table accounts add column if not exists loan_term_months integer;

-- §3: the linked debit card's network (Checking/Savings/HYSA "linked
-- card?" toggle -> card type dropdown + last 4, already on
-- debit_card_last4).
alter table accounts add column if not exists debit_card_network text;

-- ============================================================
-- Moss — Revision 09
-- ============================================================

-- §0.1/§0.2: root cause of both the duplicate-category seed bug and the
-- category-delete crash. `categories` had no unique key, so re-running the
-- demo seed's plain insert multiplied every row on each run instead of
-- converging; `recurring_items.category_id` / `card_charges.category_id`
-- had no ON DELETE behavior, so Postgres's default (block the delete with
-- a raw FK-violation error) fired whenever a bill/charge referenced the
-- category being deleted.

-- De-dupe any categories the old bug already created before the unique
-- constraint below can be added — keeps the lowest id per (user_id, name),
-- drops the rest. Anything that referenced a dropped duplicate falls back
-- to "no category" via the ON DELETE SET NULL added next, not an error.
delete from categories a using categories b
where a.user_id = b.user_id and a.name = b.name and a.id > b.id;

-- Re-point both FKs to SET NULL on delete (findable by relation, not by a
-- guessed constraint name, since Postgres's auto-generated name isn't
-- guaranteed) so deleting a category detaches it from anything that used
-- it instead of throwing.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'recurring_items'::regclass
      and confrelid = 'categories'::regclass
      and contype = 'f'
  loop
    execute format('alter table recurring_items drop constraint %I', con.conname);
  end loop;
end $$;

alter table recurring_items
  add constraint recurring_items_category_id_fkey
  foreign key (category_id) references categories on delete set null;

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'card_charges'::regclass
      and confrelid = 'categories'::regclass
      and contype = 'f'
  loop
    execute format('alter table card_charges drop constraint %I', con.conname);
  end loop;
end $$;

alter table card_charges
  add constraint card_charges_category_id_fkey
  foreign key (category_id) references categories on delete set null;

-- Now safe to add — the dedupe above guarantees no existing violation.
do $$
begin
  alter table categories add constraint categories_user_name_unique unique (user_id, name);
exception
  when duplicate_object then null;
end $$;

-- §6.4: financial institution, free text (e.g. "TD Bank") — new account field.
alter table accounts add column if not exists institution text;
