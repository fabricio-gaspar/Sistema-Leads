import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { zapiBaseUrl } from '../_shared/runtimeSafety.ts';

const text = (value: unknown, max = 1_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function whatsappPhone(value: unknown): string {
  const digits = text(value, 80).replace(/\D/g, '');
  const normalized = /^[1-9]\d{9,10}$/.test(digits) ? `55${digits}` : digits;
  if (!/^\d{12,15}$/.test(normalized)) throw new Error('test_phone_invalid');
  return normalized;
}

function failureCode(status: number): string {
  if (status === 400) return 'zapi_test_message_rejected';
  if (status === 401 || status === 403) return 'zapi_credentials_rejected';
  if (status === 404) return 'zapi_instance_not_found';
  if (status === 429) return 'zapi_rate_limited';
  return `zapi_test_http_${status}`;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);

  try {
    const body = await request.json().catch(() => ({})) as { phone?: unknown; message?: unknown; confirmation?: unknown };
    if (body.confirmation !== 'SEND_REAL_WHATSAPP_TEST') throw new Error('test_message_confirmation_required');
    const phone = whatsappPhone(body.phone);
    const message = text(body.message, 600);
    if (!message) throw new Error('test_message_required');

    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);

    const { data: integration, error: integrationError } = await admin.from('integrations')
      .select('id,provider,paused').eq('organization_id', organizationId).eq('key', 'whatsapp').maybeSingle();
    if (integrationError || !integration) throw new Error('whatsapp_integration_not_configured');
    if (integration.paused) throw new Error('whatsapp_paused_by_risk_policy');

    const { data: secret, error: secretError } = await admin.rpc('read_integration_secret', { p_integration: integration.id });
    const credentials = object(secret);
    const instanceId = text(credentials.instancia_id, 300);
    const token = text(credentials.token, 500);
    const clientToken = text(credentials.client_token, 500);
    if (secretError || !instanceId || !token || !clientToken) throw new Error('zapi_credentials_incomplete');
    const baseUrl = zapiBaseUrl(credentials.url_base);
    const headersToProvider = { 'Content-Type': 'application/json', 'Client-Token': clientToken };

    const statusResponse = await fetch(`${baseUrl}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/status`, {
      headers: headersToProvider, signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
    const statusBody = await statusResponse.json().catch(() => null) as { connected?: unknown; smartphoneConnected?: unknown } | null;
    if (!statusResponse.ok) throw new Error(failureCode(statusResponse.status));
    if (statusBody?.connected !== true) throw new Error('zapi_instance_not_connected');
    if (statusBody?.smartphoneConnected !== true) throw new Error('zapi_phone_offline');

    const sendResponse = await fetch(`${baseUrl}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/send-text`, {
      method: 'POST', headers: headersToProvider, body: JSON.stringify({ phone, message }), signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
    const receipt = await sendResponse.json().catch(() => null) as { messageId?: unknown } | null;
    if (!sendResponse.ok) throw new Error(failureCode(sendResponse.status));
    if (typeof receipt?.messageId !== 'string' || !receipt.messageId) throw new Error('zapi_test_receipt_missing');

    const now = new Date().toISOString();
    const { error: healthError } = await admin.from('integrations').update({
      connected: true, enabled: true, paused: false,
      status_detail: 'Conexão Z-API validada. A última mensagem de teste foi aceita pelo provedor.',
      last_tested_at: now, last_success_at: now, last_error: null, last_error_at: null, updated_at: now,
    }).eq('id', integration.id).eq('organization_id', organizationId);
    if (healthError) throw new Error('whatsapp_test_status_save_failed');
    await admin.from('audit_logs').insert({
      organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user',
      action: 'outreach.whatsapp_direct_test_sent',
      detail: 'Mensagem de teste aceita pela Z-API após validação de conexão.',
      entity_table: 'integrations', entity_id: integration.id,
      event_data: { phone_suffix: phone.slice(-4), message_length: message.length, provider_message_id: receipt.messageId },
    });

    return json({ ok: true, providerAccepted: true, phoneSuffix: phone.slice(-4) }, 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
