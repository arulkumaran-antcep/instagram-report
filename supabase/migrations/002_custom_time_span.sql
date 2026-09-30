-- Adds custom analysis windows (e.g. 1 Jan - 31 Mar). Safe to re-run.
-- For preset spans (3/6/12 months) these stay null and the window is
-- measured back from the moment the report runs.
alter table public.reports add column if not exists window_start date;
alter table public.reports add column if not exists window_end date;
