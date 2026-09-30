-- Reports can now be built from an uploaded Apify export instead of a live
-- scrape. source_data holds the parsed public post data so "Try again" works
-- without asking for the file again. The uploaded file itself is never stored.
-- Safe to re-run.
alter table public.reports add column if not exists source text not null default 'scrape';
alter table public.reports add column if not exists source_data jsonb;
do $$ begin
  alter table public.reports add constraint reports_source_check check (source in ('scrape', 'upload'));
exception when duplicate_object then null; end $$;
