begin;

-- A queued catalog image is tied to its exact lead message. This prevents a
-- retry from creating multiple attachment records for the same delivery.
create unique index if not exists message_attachments_message_external_url_unique
  on public.message_attachments (organization_id, message_id, external_url)
  where message_id is not null and external_url is not null;

-- The new optional argument keeps older callers compatible through its default.
-- Drop the old signature first so PostgreSQL does not retain an ambiguous
-- overload for the same catalog queue path.
drop function if exists public.queue_human_whatsapp_catalog_message(
  uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, text, boolean, timestamptz
);

create function public.queue_human_whatsapp_catalog_message(
  p_organization_id uuid,
  p_lead_id uuid,
  p_user_id uuid,
  p_sender_name text,
  p_request_id uuid,
  p_recipient text,
  p_message text,
  p_integration_id uuid,
  p_context_last_contact timestamptz,
  p_item_id uuid,
  p_presentation_format text,
  p_controlled_test boolean default false,
  p_controlled_test_expires_at timestamptz default null,
  p_send_image boolean default false
)
returns table(job_id uuid, message_id uuid, job_status text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_queue record;
  v_item public.knowledge_catalog_items%rowtype;
  v_format text := lower(trim(coalesce(p_presentation_format, '')));
  v_payload jsonb;
begin
  if p_item_id is null or v_format not in ('quick', 'commercial', 'technical', 'link', 'document') then
    raise exception 'catalog_content_input_required';
  end if;
  select * into v_item from public.knowledge_catalog_items
    where id = p_item_id and organization_id = p_organization_id and status = 'active';
  if not found then raise exception 'catalog_content_not_available'; end if;
  if p_send_image and nullif(btrim(coalesce(v_item.image_url, '')), '') is null then
    raise exception 'catalog_media_not_available';
  end if;

  select * into v_queue from public.queue_human_whatsapp_message(
    p_organization_id, p_lead_id, p_user_id, p_sender_name, p_request_id, p_recipient, p_message,
    p_integration_id, p_context_last_contact, p_controlled_test, p_controlled_test_expires_at
  );

  select payload into v_payload from public.outreach_jobs where id = v_queue.job_id;
  if v_queue.duplicate and (
    v_payload ->> 'catalog_item_id' is distinct from p_item_id::text
    or v_payload ->> 'catalog_presentation_format' is distinct from v_format
    or coalesce(v_payload ->> 'catalog_send_image', 'false') is distinct from p_send_image::text
  ) then
    raise exception 'idempotency_payload_mismatch';
  end if;

  update public.outreach_jobs
    set payload = coalesce(payload, '{}'::jsonb)
      || jsonb_build_object(
        'catalog_item_id', p_item_id,
        'catalog_presentation_format', v_format,
        'catalog_send_image', p_send_image
      )
      || case when p_send_image then jsonb_build_object(
        'media', jsonb_build_object('type', 'image', 'catalog_item_id', p_item_id)
      ) else '{}'::jsonb end
    where id = v_queue.job_id;

  if p_send_image then
    insert into public.message_attachments (
      organization_id, lead_id, message_id, media_type, file_name, external_url
    ) values (
      p_organization_id, p_lead_id, v_queue.message_id, 'image', left(v_item.name, 240), v_item.image_url
    ) on conflict (organization_id, message_id, external_url)
      where message_id is not null and external_url is not null do nothing;
  end if;

  insert into public.conversation_knowledge_events (
    organization_id, lead_id, message_id, item_id, event_type, presentation_format, actor_id, metadata
  ) values (
    p_organization_id, p_lead_id, v_queue.message_id, p_item_id, 'queued', v_format, p_user_id,
    jsonb_build_object(
      'item_name', v_item.name,
      'item_type', v_item.item_type,
      'source_url', v_item.source_url,
      'media_queued', p_send_image
    )
  ) on conflict (message_id, item_id, event_type) do nothing;

  return query select v_queue.job_id, v_queue.message_id, v_queue.job_status, v_queue.duplicate;
end;
$function$;

revoke all on function public.queue_human_whatsapp_catalog_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, text, boolean, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.queue_human_whatsapp_catalog_message(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamptz, uuid, text, boolean, timestamptz, boolean) to service_role;

commit;
