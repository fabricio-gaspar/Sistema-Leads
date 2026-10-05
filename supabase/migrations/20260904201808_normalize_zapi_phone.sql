-- Keep all WhatsApp identifiers in E.164 digits so Z-API webhooks can match leads.
create or replace function public.normalize_zapi_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if v_digits = '' then return null; end if;
  if left(v_digits, 2) = '00' then v_digits := substring(v_digits from 3); end if;
  if length(v_digits) in (10, 11) then v_digits := '55' || v_digits; end if;
  return v_digits;
end;
$$;

create or replace function public.normalize_lead_zapi_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone := public.normalize_zapi_phone(new.phone);
  new.whatsapp := public.normalize_zapi_phone(coalesce(new.whatsapp, new.phone));
  return new;
end;
$$;

drop trigger if exists normalize_lead_zapi_phone_before_write on public.leads;
create trigger normalize_lead_zapi_phone_before_write
before insert or update of phone, whatsapp on public.leads
for each row execute function public.normalize_lead_zapi_phone();

update public.leads
set phone = public.normalize_zapi_phone(phone),
    whatsapp = public.normalize_zapi_phone(coalesce(whatsapp, phone))
where phone is not null or whatsapp is not null;

-- Move the previously generic UI blob into the relational source read by ana-run.
-- Each approved answer becomes one document and one active knowledge chunk.
with source_entries as (
  select omd.organization_id, entry
  from public.organization_module_data omd
  cross join lateral jsonb_array_elements(omd.data) as entry
  where omd.module_key = 'conhecimento'
    and jsonb_typeof(omd.data) = 'array'
), inserted_documents as (
  insert into public.documents (
    organization_id, name, content_text, type, status, source_type, category,
    visibility, metadata
  )
  select
    source_entries.organization_id,
    nullif(source_entries.entry ->> 'titulo', ''),
    nullif(source_entries.entry ->> 'conteudo', ''),
    'text/plain',
    case when source_entries.entry ->> 'status' = 'ativo' then 'active' else 'draft' end,
    'manual',
    'knowledge',
    'team',
    jsonb_build_object(
      'ana_memory', true,
      'legacy_entry_id', source_entries.entry ->> 'id',
      'category', source_entries.entry ->> 'categoria',
      'question', nullif(source_entries.entry ->> 'pergunta', ''),
      'keywords', coalesce(source_entries.entry -> 'palavrasChave', '[]'::jsonb),
      'author', coalesce(source_entries.entry ->> 'autor', 'Equipe Wayflex'),
      'uses', coalesce((source_entries.entry ->> 'usos')::integer, 0)
    )
  from source_entries
  where nullif(source_entries.entry ->> 'titulo', '') is not null
    and nullif(source_entries.entry ->> 'conteudo', '') is not null
    and not exists (
      select 1
      from public.documents existing
      where existing.organization_id = source_entries.organization_id
        and existing.metadata ->> 'legacy_entry_id' = source_entries.entry ->> 'id'
    )
  returning id, organization_id, content_text, status, metadata
)
insert into public.knowledge_chunks (
  organization_id, document_id, chunk_index, content, tokens, status, metadata
)
select
  organization_id,
  id,
  0,
  content_text,
  ceil(length(content_text)::numeric / 4)::integer,
  status,
  metadata
from inserted_documents;
