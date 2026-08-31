-- ============================================================
-- BUILD 1 — People + Contacts, custom attributes, submit_inquiry()
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ---- Enums -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'contact_type') then
    create type public.contact_type as enum (
      'payroll_compliance_review',
      'payroll_remediation_review',
      'technology_procurement',
      'payroll_system_review'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'contact_status') then
    create type public.contact_status as enum (
      'new_lead','contacted','discovery_call','proposal','won','lost'
    );
  end if;
end$$;

-- ---- People (contact directory, deduped by email) ----------
create table if not exists public.people (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  phone         text,
  company       text,
  role          text,
  source_site   text,
  ok_to_contact boolean not null default false,
  attributes    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---- Contacts (inquiry pipeline) ---------------------------
create table if not exists public.contacts (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.people(id) on delete cascade,
  type       public.contact_type not null,
  subject    text,
  message    text,
  source     text,
  status     public.contact_status not null default 'new_lead',
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists contacts_created_at_idx on public.contacts (created_at desc);
create index if not exists contacts_person_id_idx  on public.contacts (person_id);
create index if not exists contacts_status_idx      on public.contacts (status);

-- ---- Row Level Security: lock everything. -------------------
-- No policies are defined, so the anon and authenticated roles
-- have NO access. Only the service_role (used server-side) and
-- the table owner can touch these tables. Secrets never reach
-- the browser.
alter table public.people   enable row level security;
alter table public.contacts enable row level security;

-- ---- submit_inquiry(): atomic upsert-person + insert-contact
-- Dedupes the person by email and merges their attributes so a
-- repeat submit updates one row instead of creating a duplicate.
create or replace function public.submit_inquiry(
  p_email         text,
  p_name          text,
  p_phone         text,
  p_company       text,
  p_role          text,
  p_source_site   text,
  p_ok_to_contact boolean,
  p_attributes    jsonb,
  p_type          public.contact_type,
  p_subject       text,
  p_message       text,
  p_source        text,
  p_metadata      jsonb
)
returns table (person_id uuid, contact_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id  uuid;
  v_contact_id uuid;
begin
  insert into public.people as pe
    (email, name, phone, company, role, source_site, ok_to_contact, attributes)
  values
    (lower(trim(p_email)), nullif(trim(p_name), ''), nullif(trim(p_phone), ''),
     nullif(trim(p_company), ''), nullif(trim(p_role), ''), p_source_site,
     coalesce(p_ok_to_contact, false), coalesce(p_attributes, '{}'::jsonb))
  on conflict (email) do update
    set name          = coalesce(excluded.name, pe.name),
        phone         = coalesce(excluded.phone, pe.phone),
        company       = coalesce(excluded.company, pe.company),
        role          = coalesce(excluded.role, pe.role),
        source_site   = coalesce(excluded.source_site, pe.source_site),
        ok_to_contact = pe.ok_to_contact or excluded.ok_to_contact,
        attributes    = pe.attributes || excluded.attributes,
        updated_at    = now()
  returning pe.id into v_person_id;

  insert into public.contacts
    (person_id, type, subject, message, source, status, metadata)
  values
    (v_person_id, p_type, nullif(trim(p_subject), ''), nullif(trim(p_message), ''),
     p_source, 'new_lead', coalesce(p_metadata, '{}'::jsonb))
  returning id into v_contact_id;

  return query select v_person_id, v_contact_id;
end;
$$;

-- Only the server (service_role) may call this. Block anon/authenticated
-- so nobody can spam it directly with the public key.
revoke all on function public.submit_inquiry(
  text, text, text, text, text, text, boolean, jsonb,
  public.contact_type, text, text, text, jsonb
) from public, anon, authenticated;
