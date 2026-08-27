-- LeadAI Phase 2 — operational CRM source of truth
--
-- This migration moves the core operational flow to relational, tenant-scoped
-- records. It does not import the legacy JSON blobs: imports must be explicit,
-- reviewed and auditable per organization.

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;

insert into public.profiles (id, full_name, avatar_url)
select
  user_record.id,
  coalesce(user_record.raw_user_meta_data ->> 'name', split_part(coalesce(user_record.email, ''), '@', 1)),
  user_record.raw_user_meta_data ->> 'avatar_url'
from auth.users user_record
on conflict (id) do nothing;

alter table public.crm_leads
  add column if not exists is_archived boolean not null default false;

alter table public.crm_conversations
  add column if not exists protocol text,
  add column if not exists queue_name text,
  add column if not exists unread_count integer not null default 0 check (unread_count >= 0),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint crm_conversations_metadata_object check (jsonb_typeof(metadata) = 'object');

alter table public.crm_tasks
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add constraint crm_tasks_metadata_object check (jsonb_typeof(metadata) = 'object');

create unique index if not exists crm_conversations_org_protocol_unique_idx
  on public.crm_conversations (organization_id, protocol)
  where protocol is not null;

create index if not exists crm_leads_org_active_stage_updated_idx
  on public.crm_leads (organization_id, lifecycle_stage, updated_at desc)
  where not is_archived;

create index if not exists crm_leads_org_email_idx
  on public.crm_leads (organization_id, lower(primary_email))
  where primary_email is not null and not is_archived;

create index if not exists crm_messages_conversation_created_idx
  on public.crm_messages (conversation_id, created_at);

create or replace function public.set_active_organization(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = current_user_id
      and membership.status = 'active'
  ) then
    raise exception 'organization_access_denied' using errcode = '42501';
  end if;

  update public.profiles
  set active_organization_id = target_organization_id
  where id = current_user_id;
end;
$$;

create or replace function public.create_organization(
  organization_legal_name text,
  organization_display_name text,
  organization_slug text,
  organization_timezone text default 'America/Sao_Paulo'
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization public.organizations;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  insert into public.organizations (legal_name, display_name, slug, timezone, created_by)
  values (trim(organization_legal_name), trim(organization_display_name), lower(trim(organization_slug)), organization_timezone, current_user_id)
  returning * into new_organization;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_organization.id, current_user_id, 'owner', 'active');

  insert into public.organization_settings (organization_id, updated_by)
  values (new_organization.id, current_user_id);

  update public.profiles
  set active_organization_id = new_organization.id
  where id = current_user_id;

  return new_organization;
end;
$$;

revoke all on function public.set_active_organization(uuid) from public, anon;
grant execute on function public.set_active_organization(uuid) to authenticated;
revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

comment on column public.profiles.active_organization_id is 'Selected tenant for the authenticated session; it must always be an active membership.';
comment on column public.crm_leads.is_archived is 'Soft archive to preserve auditability while removing a lead from active operational views.';
