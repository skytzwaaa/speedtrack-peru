-- Apply once in Supabase SQL editor or with supabase db push.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 80)
);
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name) values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),80));
  return new;
end $$;
revoke all on function public.create_profile() from public, anon, authenticated;
create trigger speedtrack_create_profile after insert on auth.users for each row execute function public.create_profile();
create table public.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('walk','run','bike','vehicle')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  distance double precision not null check (distance >= 0 and distance < 100000),
  duration double precision not null check (duration >= 0 and duration < 31536000),
  payload jsonb not null,
  unique(id, user_id),
  check (payload->>'id' = id::text and payload->>'user_id' = user_id::text)
);
create index sessions_owner_date on public.sessions(user_id, start_time desc);
-- Children use text IDs to retain compatibility with V1 split IDs.
create table public.measurements (
  id text primary key, session_id uuid not null, user_id uuid not null,
  payload jsonb not null,
  foreign key(session_id,user_id) references public.sessions(id,user_id) on delete cascade
);
create table public.splits (like public.measurements including all);
alter table public.splits add foreign key(session_id,user_id) references public.sessions(id,user_id) on delete cascade;
create table public.events (like public.measurements including all);
alter table public.events add foreign key(session_id,user_id) references public.sessions(id,user_id) on delete cascade;
create index on public.measurements(session_id);
create index on public.splits(session_id);
create index on public.events(session_id);
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
do $$ declare tbl text; begin
  foreach tbl in array array['sessions','measurements','splits','events','user_settings'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('create policy own_data on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tbl);
  end loop;
end $$;
-- Invoker security: atomic upload obeys RLS on every table, including nested rows.
create function public.save_activity(activity jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); sid uuid := (activity->>'id')::uuid; item jsonb;
begin
  if owner is null or activity->>'user_id' is distinct from owner::text then
    raise exception 'Invalid owner' using errcode = '42501';
  end if;
  if jsonb_typeof(activity->'measurements') <> 'array' or jsonb_typeof(activity->'splits') <> 'array' or jsonb_typeof(activity->'events') <> 'array' then raise exception 'Invalid activity'; end if;
  insert into public.sessions(id,user_id,type,start_time,end_time,distance,duration,payload)
  values(sid,owner,activity->>'type',(activity->>'start_time')::timestamptz,(activity->>'end_time')::timestamptz,(activity->>'distance')::float8,(activity->>'duration')::float8,activity)
  on conflict(id) do update set payload=excluded.payload, distance=excluded.distance, duration=excluded.duration, end_time=excluded.end_time;
  delete from public.measurements where session_id=sid;
  delete from public.splits where session_id=sid;
  delete from public.events where session_id=sid;
  for item in select * from jsonb_array_elements(activity->'measurements') loop
    if item->>'session_id' is distinct from sid::text then raise exception 'Invalid measurement owner'; end if;
    insert into public.measurements values(item->>'id',sid,owner,item);
  end loop;
  for item in select * from jsonb_array_elements(activity->'splits') loop
    if item->>'session_id' is distinct from sid::text then raise exception 'Invalid split owner'; end if;
    insert into public.splits values(item->>'id',sid,owner,item);
  end loop;
  for item in select * from jsonb_array_elements(activity->'events') loop
    if item->>'session_id' is distinct from sid::text then raise exception 'Invalid event owner'; end if;
    insert into public.events values(item->>'id',sid,owner,item);
  end loop;
end $$;
revoke all on function public.save_activity(jsonb) from public, anon;
grant execute on function public.save_activity(jsonb) to authenticated;
revoke all on public.profiles, public.sessions, public.measurements, public.splits, public.events, public.user_settings from anon;
grant select,insert,update,delete on public.profiles, public.sessions, public.measurements, public.splits, public.events, public.user_settings to authenticated;
commit;
