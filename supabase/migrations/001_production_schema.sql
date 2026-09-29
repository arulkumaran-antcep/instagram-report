-- InstaReport production schema.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
-- Replaces the prototype tables (which only held test data).

drop table if exists public.report_sections cascade;
drop table if exists public.api_logs cascade;
drop table if exists public.job_logs cascade;
drop table if exists public.reports cascade;
drop table if exists public.members cascade;
drop function if exists public.is_member();

-- Team members. Only users listed here can use the app, even if someone
-- manages to create an auth account some other way.
create table public.members (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        text not null default 'member' check (role in ('admin', 'member')),
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz
);

create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  handle          text not null,
  status          text not null default 'queued'
                    check (status in ('queued', 'processing', 'completed', 'failed')),
  stage           text not null default 'queued',
  progress        integer not null default 0,
  timezone        text not null default 'Asia/Kolkata',
  window_months   integer not null default 12,
  profile         jsonb,
  stats           jsonb,
  narrative       jsonb,
  pdf_path        text,
  xlsx_path       text,
  error_message   text,
  cost            jsonb,
  created_by      uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index reports_created_at_idx on public.reports (created_at desc);
create index reports_handle_idx on public.reports (handle, created_at desc);
create index reports_status_idx on public.reports (status);

-- Per-step pipeline log for troubleshooting (server-only).
create table public.job_logs (
  id          bigint generated always as identity primary key,
  report_id   uuid not null references public.reports(id) on delete cascade,
  step        text not null,
  ok          boolean not null,
  duration_ms integer,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index job_logs_report_idx on public.job_logs (report_id);

-- Row level security: the browser's public key can read nothing unless the
-- signed-in user is a team member. All writes go through the server.
alter table public.members  enable row level security;
alter table public.reports  enable row level security;
alter table public.job_logs enable row level security;

create policy "team can read members" on public.members
  for select to authenticated using (public.is_member());
create policy "team can read reports" on public.reports
  for select to authenticated using (public.is_member());
-- job_logs: intentionally no policies (service role only).

-- Report files: private bucket, downloaded only via short-lived signed links.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do update set public = false;
