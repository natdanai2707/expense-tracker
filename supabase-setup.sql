-- Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  vendor      text not null,
  amount      numeric(12,2) not null,
  category    text not null default 'other',
  note        text default '',
  added_by    text default 'Unknown',
  line_user_id text default 'web',
  created_at  timestamptz default now()
);

-- Index for faster monthly queries
create index if not exists expenses_date_idx on expenses (date desc);

-- Enable Row Level Security (optional but recommended)
alter table expenses enable row level security;

-- Allow all operations via anon key (since we control the app)
create policy "Allow all" on expenses for all using (true) with check (true);
