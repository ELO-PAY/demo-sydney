-- ============================================================
-- BUILD 2 — Orders, activity_log, and atomic pipeline moves.
-- Idempotent: safe to re-run. Builds on 0001_build1.sql.
-- ============================================================

create extension if not exists pgcrypto;

-- ---- Enums -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'pending','paid','refunded','cancelled'
    );
  end if;
end$$;

-- ---- Orders (what people bought) ---------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.people(id) on delete cascade,
  product_name text not null,
  amount_cents integer not null default 0,
  currency     text not null default 'AUD',
  status       public.order_status not null default 'pending',
  created_at   timestamptz not null default now()
);

create index if not exists orders_person_id_idx  on public.orders (person_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ---- activity_log (one row per Contacts status change) ------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid references public.contacts(id) on delete cascade,
  person_id   uuid references public.people(id)   on delete cascade,
  from_status public.contact_status,
  to_status   public.contact_status,
  actor       text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_contact_id_idx on public.activity_log (contact_id);
create index if not exists activity_log_person_id_idx  on public.activity_log (person_id);
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

-- ---- Row Level Security: lock everything (service-role only).
-- Same posture as Build 1: no policies means anon/authenticated get
-- no access; only the server-side service_role can read or write.
alter table public.orders       enable row level security;
alter table public.activity_log enable row level security;

-- ---- set_contact_status(): move a Contacts row + log it, atomically.
-- Reads the current status under a row lock, updates only when the
-- status actually changes, and writes exactly one activity_log row for
-- that change. Returns the log row (null when nothing changed).
create or replace function public.set_contact_status(
  p_contact_id uuid,
  p_to_status  public.contact_status,
  p_actor      text,
  p_note       text
)
returns public.activity_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from   public.contact_status;
  v_person uuid;
  v_row    public.activity_log;
begin
  select status, person_id
    into v_from, v_person
  from public.contacts
  where id = p_contact_id
  for update;

  if not found then
    raise exception 'contact % not found', p_contact_id;
  end if;

  -- No-op when the stage is unchanged: don't move, don't log.
  if v_from is not distinct from p_to_status then
    return null;
  end if;

  update public.contacts
     set status = p_to_status
   where id = p_contact_id;

  insert into public.activity_log
    (contact_id, person_id, from_status, to_status, actor, note)
  values
    (p_contact_id, v_person, v_from, p_to_status,
     nullif(trim(p_actor), ''), nullif(trim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

-- Only the server (service_role) may call this.
revoke all on function public.set_contact_status(
  uuid, public.contact_status, text, text
) from public, anon, authenticated;
