-- Rally Club shared tournament backend
-- Applied to the Supabase project on 2026-09-19.

create extension if not exists pgcrypto;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state jsonb not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.tournament_editor_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  team text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  unique (tournament_id, requester_id)
);

create table if not exists public.tournament_editors (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  approved_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.tournaments enable row level security;
alter table public.tournament_editor_requests enable row level security;
alter table public.tournament_editors enable row level security;

create or replace function public.tournament_owner(tournament_uuid uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp
as $$ select owner_id from public.tournaments where id = tournament_uuid $$;

create or replace function public.is_tournament_owner(tournament_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.tournament_owner(tournament_uuid) = auth.uid() $$;

create or replace function public.is_tournament_editor(tournament_uuid uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.tournament_editors where tournament_id = tournament_uuid and user_id = auth.uid()) $$;

create or replace function public.touch_tournament_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists tournaments_touch_updated_at on public.tournaments;
create trigger tournaments_touch_updated_at before update on public.tournaments
for each row execute function public.touch_tournament_updated_at();

drop policy if exists tournament_public_read on public.tournaments;
create policy tournament_public_read on public.tournaments for select using (true);
drop policy if exists tournament_owner_insert on public.tournaments;
create policy tournament_owner_insert on public.tournaments for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists tournament_owner_or_editor_update on public.tournaments;
create policy tournament_owner_or_editor_update on public.tournaments for update to authenticated
using (public.is_tournament_owner(id) or public.is_tournament_editor(id))
with check (owner_id = public.tournament_owner(id) and (public.is_tournament_owner(id) or public.is_tournament_editor(id)));

drop policy if exists request_owner_or_requester_read on public.tournament_editor_requests;
create policy request_owner_or_requester_read on public.tournament_editor_requests for select to authenticated
using (requester_id = auth.uid() or public.is_tournament_owner(tournament_id));
drop policy if exists request_requester_insert on public.tournament_editor_requests;
create policy request_requester_insert on public.tournament_editor_requests for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists request_owner_update on public.tournament_editor_requests;
create policy request_owner_update on public.tournament_editor_requests for update to authenticated
using (public.is_tournament_owner(tournament_id)) with check (public.is_tournament_owner(tournament_id));

drop policy if exists editor_owner_or_self_read on public.tournament_editors;
create policy editor_owner_or_self_read on public.tournament_editors for select to authenticated
using (user_id = auth.uid() or public.is_tournament_owner(tournament_id));
drop policy if exists editor_owner_insert on public.tournament_editors;
create policy editor_owner_insert on public.tournament_editors for insert to authenticated with check (public.is_tournament_owner(tournament_id));
drop policy if exists editor_owner_delete on public.tournament_editors;
create policy editor_owner_delete on public.tournament_editors for delete to authenticated using (public.is_tournament_owner(tournament_id));

grant usage on schema public to anon, authenticated;
grant select on public.tournaments to anon, authenticated;
grant insert, update on public.tournaments to authenticated;
grant select, insert, update on public.tournament_editor_requests to authenticated;
grant select, insert, delete on public.tournament_editors to authenticated;
revoke all on function public.tournament_owner(uuid), public.is_tournament_owner(uuid), public.is_tournament_editor(uuid) from public;
grant execute on function public.tournament_owner(uuid), public.is_tournament_owner(uuid), public.is_tournament_editor(uuid) to authenticated;

alter table public.tournaments replica identity full;
alter table public.tournament_editor_requests replica identity full;
alter table public.tournament_editors replica identity full;
do $$ begin alter publication supabase_realtime add table public.tournaments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournament_editor_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournament_editors; exception when duplicate_object then null; end $$;
