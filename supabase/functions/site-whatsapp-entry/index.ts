import { createAdminClient, requireOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Action = 'load' | 'save' | 'rotate';
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const phone = (value: unknown) => text(value, 32).replace(/\D/g, '');

function buildLink(entry: { public_phone: string; welcome_message: string; entry_code: string }): string {
  const message = `${entry.welcome_message}\n[WF:${entry.entry_code}]`;
  return `https://wa.me/${entry.public_phone}?text=${encodeURIComponent(message)}`;
}

function newEntryCode(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
}

async function contextFor(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data: profile, error } = await admin.from('profiles').select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  return { organizationId: profile.active_organization_id, name: profile.name };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = text(body.action, 32) as Action;
    if (action !== 'load' && action !== 'save' && action !== 'rotate') throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const context = await contextFor(admin, user.id);
    await requireOrganizationPermission(admin, context.organizationId, user.id, 'website_entry.manage');

    if (action === 'load') {
      const { data, error } = await admin.from('whatsapp_site_entries').select('id,name,source_label,public_phone,welcome_message,entry_code,active,updated_at')
        .eq('organization_id', context.organizationId).maybeSingle();
      if (error) throw error;
      return json({ ok: true, entry: data ? { ...data, link: buildLink(data) } : null }, 200, headers);
    }

    if (action === 'rotate') {
      const { data: existing, error: existingError } = await admin.from('whatsapp_site_entries')
        .select('id,entry_code,name,source_label,public_phone,welcome_message,active,updated_at')
        .eq('organization_id', context.organizationId).maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error('site_entry_not_configured');
      const { data, error } = await admin.from('whatsapp_site_entries').update({
        entry_code: newEntryCode(),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).eq('organization_id', context.organizationId)
        .select('id,name,source_label,public_phone,welcome_message,entry_code,active,updated_at').single();
      if (error) throw error;
      await admin.from('audit_logs').insert({
        organization_id: context.organizationId,
        actor_id: user.id,
        actor_name: context.name,
        actor_type: 'user',
        action: 'whatsapp.site_entry_rotated',
        detail: 'Código público da entrada do site renovado.',
        entity_table: 'whatsapp_site_entries',
        entity_id: data.id,
        event_data: { active: data.active },
      });
      return json({ ok: true, entry: { ...data, link: buildLink(data) } }, 200, headers);
    }

    const publicPhone = phone(body.public_phone);
    const name = text(body.name, 120);
    const sourceLabel = text(body.source_label, 120);
    const welcomeMessage = text(body.welcome_message, 500);
    if (publicPhone.length < 10 || publicPhone.length > 15) throw new Error('invalid_whatsapp_public_phone');
    if (!name || !sourceLabel || !welcomeMessage) throw new Error('site_entry_fields_required');
    if (typeof body.active !== 'boolean') throw new Error('site_entry_status_required');

    const { data, error } = await admin.from('whatsapp_site_entries').upsert({
      organization_id: context.organizationId,
      name,
      source_label: sourceLabel,
      public_phone: publicPhone,
      welcome_message: welcomeMessage,
      active: body.active,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' }).select('id,name,source_label,public_phone,welcome_message,entry_code,active,updated_at').single();
    if (error) throw error;
    await admin.from('audit_logs').insert({
      organization_id: context.organizationId,
      actor_id: user.id,
      actor_name: context.name,
      actor_type: 'user',
      action: 'whatsapp.site_entry_saved',
      detail: body.active ? 'Entrada de WhatsApp do site ativada.' : 'Entrada de WhatsApp do site pausada.',
      entity_table: 'whatsapp_site_entries',
      entity_id: data.id,
      event_data: { active: body.active, source_label: sourceLabel },
    });
    return json({ ok: true, entry: { ...data, link: buildLink(data) } }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
