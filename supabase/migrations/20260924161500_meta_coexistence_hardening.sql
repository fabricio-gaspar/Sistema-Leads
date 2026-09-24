-- Make the service-only boundary explicit and cover every new foreign key used
-- during cleanup, reconciliation and provider account removal.

create policy meta_onboarding_sessions_service_boundary
  on public.meta_onboarding_sessions for all to authenticated
  using (false) with check (false);
create policy messaging_webhook_events_service_boundary
  on public.messaging_webhook_events for all to authenticated
  using (false) with check (false);
create policy message_status_events_service_boundary
  on public.message_status_events for all to authenticated
  using (false) with check (false);
create policy messaging_outbox_service_boundary
  on public.messaging_outbox for all to authenticated
  using (false) with check (false);

create index meta_onboarding_sessions_requested_by_idx
  on public.meta_onboarding_sessions (requested_by);
create index meta_onboarding_sessions_owner_user_idx
  on public.meta_onboarding_sessions (owner_user_id) where owner_user_id is not null;
create index organization_feature_flags_enabled_by_idx
  on public.organization_feature_flags (enabled_by) where enabled_by is not null;
create index messaging_provider_controls_changed_by_idx
  on public.messaging_provider_controls (changed_by) where changed_by is not null;

create index whatsapp_conversations_account_fk_idx
  on public.whatsapp_conversations (whatsapp_account_id);
create index whatsapp_conversations_owner_fk_idx
  on public.whatsapp_conversations (owner_user_id) where owner_user_id is not null;

create index messaging_webhook_events_organization_fk_idx
  on public.messaging_webhook_events (organization_id) where organization_id is not null;
create index messaging_webhook_events_account_fk_idx
  on public.messaging_webhook_events (whatsapp_account_id) where whatsapp_account_id is not null;

create index message_status_events_account_fk_idx
  on public.message_status_events (whatsapp_account_id);
create index message_status_events_lead_message_fk_idx
  on public.message_status_events (lead_message_id) where lead_message_id is not null;

create index messaging_outbox_account_fk_idx
  on public.messaging_outbox (whatsapp_account_id);
create index messaging_outbox_lead_fk_idx
  on public.messaging_outbox (lead_id);
create index messaging_outbox_lead_message_fk_idx
  on public.messaging_outbox (lead_message_id) where lead_message_id is not null;
create index messaging_outbox_requested_by_fk_idx
  on public.messaging_outbox (requested_by) where requested_by is not null;

create index whatsapp_sync_state_organization_fk_idx
  on public.whatsapp_sync_state (organization_id);
create index whatsapp_templates_organization_fk_idx
  on public.whatsapp_templates (organization_id);
create index seller_routing_profiles_user_fk_idx
  on public.seller_routing_profiles (user_id);
create index seller_routing_profiles_account_fk_idx
  on public.seller_routing_profiles (whatsapp_account_id) where whatsapp_account_id is not null;
