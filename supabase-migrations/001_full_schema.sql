-- ============================================================
-- Expense Tracker — full schema migration (idempotent, non-destructive)
-- Run in Supabase → SQL Editor → New query → paste → Run.
-- Safe to run multiple times. Does NOT drop or truncate anything.
-- ============================================================

-- ── expenses ────────────────────────────────────────────────
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  vendor       text not null default 'ไม่ระบุ',
  amount       numeric(12,2) not null,
  category     text not null default 'other',
  created_at   timestamptz default now()
);

-- Columns added over time — add only if missing.
alter table expenses add column if not exists sub_category    text default '';
alter table expenses add column if not exists note            text default '';
alter table expenses add column if not exists added_by        text default 'Unknown';
alter table expenses add column if not exists line_user_id    text default 'web';
alter table expenses add column if not exists group_id        text default 'default';
alter table expenses add column if not exists type            text not null default 'expense';
alter table expenses add column if not exists income_category text default '';
alter table expenses add column if not exists receipt_url     text;

-- Indexes on the columns actually queried.
create index if not exists expenses_date_idx           on expenses (date desc);
create index if not exists expenses_group_date_idx     on expenses (group_id, date desc);
create index if not exists expenses_group_type_date_idx on expenses (group_id, type, date desc);
create index if not exists expenses_group_cat_idx      on expenses (group_id, category);

-- ── group_config ────────────────────────────────────────────
create table if not exists group_config (
  group_id   text primary key,
  name       text default 'กลุ่มของฉัน',
  categories text[] default array['personal','other'],
  budgets    jsonb  default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table group_config add column if not exists budgets jsonb default '{}'::jsonb;

-- ── pending_actions (LINE bot confirmation state) ───────────
-- Replaces the in-memory Map so postbacks resolve across serverless
-- instances. Rows are short-lived and cleaned up on confirm/cancel/expiry.
create table if not exists pending_actions (
  id         text primary key,
  payload    jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists pending_actions_expires_idx on pending_actions (expires_at);

-- ── recurring_transactions (rent, salary, subscriptions) ────
create table if not exists recurring_transactions (
  id              uuid primary key default gen_random_uuid(),
  group_id        text not null,
  day_of_month    int  not null default 1,       -- 1..28
  type            text not null default 'expense',
  vendor          text not null,
  amount          numeric(12,2) not null,
  category        text not null default 'other',
  sub_category    text default '',
  income_category text default '',
  note            text default '',
  active          boolean default true,
  last_run        date,
  created_at      timestamptz default now()
);
create index if not exists recurring_group_idx on recurring_transactions (group_id, active);

-- ── Seed the two known groups (no-op if they already exist) ──
insert into group_config (group_id, name, categories)
values ('C174382191b4c63db85ae4a689ec99812', 'Surf',
        array['personal','with_layers','met','steel_s2000','south_steel','other'])
on conflict (group_id) do nothing;

insert into group_config (group_id, name, categories)
values ('C4827c4a2d8c9d62b2d2dba2e59aaee71', 'แม่', array['personal','other'])
on conflict (group_id) do nothing;

-- ── Row Level Security (app controls access via anon key) ───
alter table expenses               enable row level security;
alter table group_config           enable row level security;
alter table pending_actions        enable row level security;
alter table recurring_transactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='expenses' and policyname='Allow all') then
    create policy "Allow all" on expenses for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='group_config' and policyname='Allow all') then
    create policy "Allow all" on group_config for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='pending_actions' and policyname='Allow all') then
    create policy "Allow all" on pending_actions for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='recurring_transactions' and policyname='Allow all') then
    create policy "Allow all" on recurring_transactions for all using (true) with check (true);
  end if;
end $$;

-- ── Storage bucket for receipt images (optional; safe if exists) ──
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;
