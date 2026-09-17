-- A phone number is not evidence that the contact uses WhatsApp.
-- Preserve an explicitly supplied WhatsApp identity, but never derive one from phone.
create or replace function public.normalize_lead_zapi_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone := public.normalize_zapi_phone(new.phone);
  new.whatsapp := case
    when nullif(btrim(new.whatsapp), '') is null then null
    else public.normalize_zapi_phone(new.whatsapp)
  end;
  return new;
end;
$$;

-- Correct only manual pending records created while the former trigger inferred WhatsApp.
update public.leads
set whatsapp = null
where contact_approval_status = 'pending'
  and phone is not null
  and whatsapp = phone
  and contact_approval_reason = 'Lead manual criado; aguardando comprovação de canal e autorização para primeiro contato.';
