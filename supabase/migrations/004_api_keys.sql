-- API keys managed from Settings (admin only) and the monthly budgets used to
-- track credit. Keys are stored encrypted; only the server (service role) can
-- read these tables. Safe to re-run.
create table if not exists public.app_secrets (
  name        text primary key check (name in ('apify_token', 'anthropic_key')),
  ciphertext  text not null,
  last4       text not null,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_secrets enable row level security;
alter table public.app_settings enable row level security;
-- No policies on purpose: the anon/authenticated roles get no access at all.
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;
