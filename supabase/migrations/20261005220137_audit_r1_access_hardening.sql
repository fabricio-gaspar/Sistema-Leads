-- R1 / ACH-SEC-001..004. No data deletion, provider call or automation activation.
-- Remove the permissive OR branches, not the existing service_role bypass.
drop policy if exists org_active_access on public.proposals;
drop policy if exists phase2_proposals_select on public.proposals;
drop policy if exists phase2_proposals_insert on public.proposals;
drop policy if exists phase2_proposals_update on public.proposals;
drop policy if exists phase2_proposals_delete on public.proposals;

create function private.r1_can_access_proposal(_org uuid, _owner uuid, _lead uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_org_member(_org, (select auth.uid()))
    and case when _lead is not null
      then private.can_access_lead(_org, _lead, (select auth.uid()))
      else _owner = (select auth.uid())
        or private.has_org_permission(_org, (select auth.uid()), 'leads.read_all')
    end;
$$;
revoke all on function private.r1_can_access_proposal(uuid, uuid, uuid) from public, anon;
grant execute on function private.r1_can_access_proposal(uuid, uuid, uuid) to authenticated, service_role;

create policy r1_proposals_select on public.proposals for select to authenticated
  using (private.r1_can_access_proposal(organization_id, owner_id, lead_id));
create policy r1_proposals_insert on public.proposals for insert to authenticated
  with check (private.r1_can_access_proposal(organization_id, owner_id, lead_id)
    and private.has_org_permission(organization_id, (select auth.uid()), 'proposals.manage'));
create policy r1_proposals_update on public.proposals for update to authenticated
  using (private.r1_can_access_proposal(organization_id, owner_id, lead_id)
    and private.has_org_permission(organization_id, (select auth.uid()), 'proposals.manage'))
  with check (private.r1_can_access_proposal(organization_id, owner_id, lead_id)
    and private.has_org_permission(organization_id, (select auth.uid()), 'proposals.manage'));
create policy r1_proposals_delete on public.proposals for delete to authenticated
  using (private.r1_can_access_proposal(organization_id, owner_id, lead_id)
    and private.has_org_permission(organization_id, (select auth.uid()), 'proposals.manage'));

-- Explicit sharing is read-only. 'ai' is not a human-team sharing flag.
create function private.r1_can_read_document(_org uuid, _uploader uuid, _visibility text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_org_member(_org, (select auth.uid())) and (
    _uploader = (select auth.uid())
    or private.has_org_permission(_org, (select auth.uid()), 'configuration.manage')
    or _visibility = 'team'
    or (_visibility = 'sellers' and private.has_org_role(_org, (select auth.uid()),
      array['vendedor', 'sdr']::public.app_role[]))
  );
$$;
create function private.r1_can_write_document(_org uuid, _uploader uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_org_member(_org, (select auth.uid())) and (
    _uploader = (select auth.uid())
    or private.has_org_permission(_org, (select auth.uid()), 'configuration.manage')
  );
$$;
create function private.r1_can_access_document_id(_org uuid, _document uuid, _write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.documents d where d.id = _document and d.organization_id = _org
    and case when _write then private.r1_can_write_document(d.organization_id, d.uploaded_by)
      else private.r1_can_read_document(d.organization_id, d.uploaded_by, d.visibility) end);
$$;
revoke all on function private.r1_can_read_document(uuid, uuid, text),
  private.r1_can_write_document(uuid, uuid), private.r1_can_access_document_id(uuid, uuid, boolean) from public, anon;
grant execute on function private.r1_can_read_document(uuid, uuid, text),
  private.r1_can_write_document(uuid, uuid), private.r1_can_access_document_id(uuid, uuid, boolean) to authenticated, service_role;

drop policy if exists org_active_access on public.documents;
drop policy if exists phase2_documents_select on public.documents;
drop policy if exists phase2_documents_insert on public.documents;
drop policy if exists phase2_documents_update on public.documents;
drop policy if exists phase2_documents_delete on public.documents;
create policy r1_documents_select on public.documents for select to authenticated
  using (private.r1_can_read_document(organization_id, uploaded_by, visibility));
create policy r1_documents_insert on public.documents for insert to authenticated
  with check (private.r1_can_write_document(organization_id, uploaded_by));
create policy r1_documents_update on public.documents for update to authenticated
  using (private.r1_can_write_document(organization_id, uploaded_by))
  with check (private.r1_can_write_document(organization_id, uploaded_by));
create policy r1_documents_delete on public.documents for delete to authenticated
  using (private.r1_can_write_document(organization_id, uploaded_by));

-- Protect document content through its dependent table as well.
drop policy if exists org_active_access on public.knowledge_chunks;
create policy r1_knowledge_chunks_select on public.knowledge_chunks for select to authenticated
  using (private.r1_can_access_document_id(organization_id, document_id, false));
create policy r1_knowledge_chunks_insert on public.knowledge_chunks for insert to authenticated
  with check (private.r1_can_access_document_id(organization_id, document_id, true));
create policy r1_knowledge_chunks_update on public.knowledge_chunks for update to authenticated
  using (private.r1_can_access_document_id(organization_id, document_id, true))
  with check (private.r1_can_access_document_id(organization_id, document_id, true));
create policy r1_knowledge_chunks_delete on public.knowledge_chunks for delete to authenticated
  using (private.r1_can_access_document_id(organization_id, document_id, true));

create index if not exists documents_r1_storage_path_idx
  on public.documents (organization_id, storage_path) where storage_path is not null;

-- owner_id is authoritative; deprecated owner is only a legacy fallback.
-- Upload is allowed BEFORE a document exists; failed uploads can be cleaned up by their owner.
-- A forged document pointing at someone else's object cannot grant access: uploader must match
-- the actual object owner. Legacy/service-owned objects with no trusted link stay admin-only.
create function private.r1_can_access_storage(_bucket text, _name text, _owner text, _write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select _bucket in ('docs', 'ana-knowledge', 'message-media')
    and split_part(_name, '/', 1) = (select public.current_org_id())::text
    and private.is_active_org_member((select public.current_org_id()), (select auth.uid()))
    and (
      (_owner = (select auth.uid())::text and (
        _bucket <> 'message-media' or split_part(_name, '/', 2) <> 'leads'
        or case when _write then private.can_manage_lead((select public.current_org_id()),
          case when split_part(_name, '/', 3) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            then split_part(_name, '/', 3)::uuid else null end, (select auth.uid()))
          else private.can_access_lead((select public.current_org_id()),
          case when split_part(_name, '/', 3) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            then split_part(_name, '/', 3)::uuid else null end, (select auth.uid())) end
      ))
      or private.has_org_permission((select public.current_org_id()), (select auth.uid()), 'configuration.manage')
      or (not _write and _bucket in ('docs', 'ana-knowledge') and exists (
        select 1 from public.documents d
        where d.organization_id = (select public.current_org_id()) and d.storage_path = _name
          and d.uploaded_by::text = _owner
          and private.r1_can_read_document(d.organization_id, d.uploaded_by, d.visibility)
      ))
      or (not _write and _bucket = 'message-media' and split_part(_name, '/', 2) = 'leads'
        and private.can_access_lead((select public.current_org_id()),
          case when split_part(_name, '/', 3) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            then split_part(_name, '/', 3)::uuid else null end, (select auth.uid())))
    );
$$;
revoke all on function private.r1_can_access_storage(text, text, text, boolean) from public, anon;
grant execute on function private.r1_can_access_storage(text, text, text, boolean) to authenticated, service_role;
drop policy if exists storage_active_org_read on storage.objects;
drop policy if exists storage_active_org_insert on storage.objects;
drop policy if exists storage_active_org_update on storage.objects;
drop policy if exists storage_active_org_delete on storage.objects;
drop policy if exists storage_ana_knowledge_read on storage.objects;
drop policy if exists storage_ana_knowledge_insert on storage.objects;
drop policy if exists storage_ana_knowledge_update on storage.objects;
drop policy if exists storage_ana_knowledge_delete on storage.objects;
create policy r1_storage_select on storage.objects for select to authenticated
  using (private.r1_can_access_storage(bucket_id, name, coalesce(owner_id, owner::text), false));
create policy r1_storage_insert on storage.objects for insert to authenticated
  with check (private.r1_can_access_storage(bucket_id, name, coalesce(owner_id, owner::text), true));
create policy r1_storage_update on storage.objects for update to authenticated
  using (private.r1_can_access_storage(bucket_id, name, coalesce(owner_id, owner::text), true))
  with check (private.r1_can_access_storage(bucket_id, name, coalesce(owner_id, owner::text), true));
create policy r1_storage_delete on storage.objects for delete to authenticated
  using (private.r1_can_access_storage(bucket_id, name, coalesce(owner_id, owner::text), true));

-- Central may add/repeat a suppression on its own lead, never weaken one.
-- Configuration managers retain the explicit audited removal action used by the UI.
drop policy if exists org_active_access on public.contact_suppressions;
create policy r1_suppressions_select on public.contact_suppressions for select to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())) and (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or private.can_access_lead(organization_id, lead_id, (select auth.uid()))));
create policy r1_suppressions_insert on public.contact_suppressions for insert to authenticated
  with check (private.is_active_org_member(organization_id, (select auth.uid())) and (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or private.can_manage_lead(organization_id, lead_id, (select auth.uid()))));
create policy r1_suppressions_update on public.contact_suppressions for update to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid())) and (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or private.can_manage_lead(organization_id, lead_id, (select auth.uid()))))
  with check (private.is_active_org_member(organization_id, (select auth.uid())) and (
    private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
    or private.can_manage_lead(organization_id, lead_id, (select auth.uid()))));
create policy r1_suppressions_delete on public.contact_suppressions for delete to authenticated
  using (private.is_active_org_member(organization_id, (select auth.uid()))
    and private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage'));

create function private.r1_preserve_contact_suppression()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role', true) = 'authenticated'
    and not private.has_org_permission(old.organization_id, (select auth.uid()), 'configuration.manage')
    and (new.organization_id is distinct from old.organization_id
      or new.contact_hash is distinct from old.contact_hash
      or new.contact is distinct from old.contact
      or new.lead_id is distinct from old.lead_id
      or (new.channel is distinct from old.channel and new.channel is distinct from 'all')) then
    raise exception 'suppression_change_requires_configuration_manage' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.r1_preserve_contact_suppression() from public, anon, authenticated;
create trigger r1_preserve_contact_suppression before update on public.contact_suppressions
  for each row execute function private.r1_preserve_contact_suppression();

-- A real MVCC write, NOT just an advisory/row read lock, serializes demotions per org.
-- READ COMMITTED gets a fresh snapshot for the subsequent count in this VOLATILE trigger.
-- REPEATABLE READ/SERIALIZABLE abort a stale concurrent writer (40001), preventing write skew.
-- No duplicated admin counter; the existing memberships remain the source of truth.
create function private.r1_preserve_last_active_admin()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  if old.role::text <> 'administrador' or old.status <> 'active' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' and new.organization_id = old.organization_id
    and new.role::text = 'administrador' and new.status = 'active' then return new; end if;

  update public.organizations set updated_at = updated_at where id = old.organization_id;
  -- Parent already removed during ON DELETE CASCADE: deleting the organization itself remains valid.
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if not exists (select 1 from public.organization_members m
    where m.organization_id = old.organization_id and m.user_id <> old.user_id
      and m.role::text = 'administrador' and m.status = 'active') then
    raise exception 'organization_requires_active_administrator' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.r1_preserve_last_active_admin() from public, anon, authenticated;
create trigger r1_preserve_last_active_admin before update or delete on public.organization_members
  for each row execute function private.r1_preserve_last_active_admin();
-- TRUNCATE has no row triggers/RLS and is not part of any application membership workflow.
revoke truncate on public.organization_members from authenticated, anon, service_role;
create index if not exists organization_members_r1_active_admin_idx
  on public.organization_members (organization_id, user_id) where role = 'administrador' and status = 'active';
