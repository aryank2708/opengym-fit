-- Run once in the Supabase SQL editor of the project you use for sync.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "own row select" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
