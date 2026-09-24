-- Close remaining ownership and provider-message integrity gaps found by the
-- post-migration security review.

alter table public.lead_messages
  add column if not exists provider_media_id text;

create unique index if not exists lead_messages_meta_provider_message_uidx
  on public.lead_messages (organization_id, provider_message_id)
  where provider = 'meta_cloud' and provider_message_id is not null;

drop policy if exists whatsapp_conversations_read on public.whatsapp_conversations;
create policy whatsapp_conversations_read on public.whatsapp_conversations
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'conversations.read_all')
    or (
      private.is_active_org_member(organization_id, (select auth.uid()))
      and owner_user_id = (select auth.uid())
    )
    or (
      private.is_active_org_member(organization_id, (select auth.uid()))
      and exists (
        select 1 from public.leads l
        where l.id = whatsapp_conversations.lead_id
          and l.organization_id = whatsapp_conversations.organization_id
          and (l.owner_id = (select auth.uid()) or l.assigned_to = (select auth.uid()))
      )
    )
  );

drop policy if exists whatsapp_sync_state_read on public.whatsapp_sync_state;
create policy whatsapp_sync_state_read on public.whatsapp_sync_state
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'channels.manage_all')
    or (
      private.is_active_org_member(organization_id, (select auth.uid()))
      and exists (
        select 1 from public.whatsapp_accounts a
        where a.id = whatsapp_sync_state.whatsapp_account_id
          and a.organization_id = whatsapp_sync_state.organization_id
          and a.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists whatsapp_templates_read on public.whatsapp_templates;
create policy whatsapp_templates_read on public.whatsapp_templates
  for select to authenticated
  using (
    private.has_org_permission(organization_id, (select auth.uid()), 'conversations.read_all')
    or (
      private.is_active_org_member(organization_id, (select auth.uid()))
      and exists (
        select 1 from public.whatsapp_accounts a
        where a.id = whatsapp_templates.whatsapp_account_id
          and a.organization_id = whatsapp_templates.organization_id
          and a.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists seller_routing_profiles_read on public.seller_routing_profiles;
create policy seller_routing_profiles_read on public.seller_routing_profiles
  for select to authenticated
  using (
    (
      private.is_active_org_member(organization_id, (select auth.uid()))
      and user_id = (select auth.uid())
    )
    or private.has_org_permission(organization_id, (select auth.uid()), 'team.manage')
    or private.has_org_permission(organization_id, (select auth.uid()), 'configuration.manage')
  );
