import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { zapiBaseUrl } from '../_shared/runtimeSafety.ts';

const text = (value: unknown, max = 1_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

type DirectTestReservationStatus = 'reserved' | 'provider_accepted' | 'reconciliation_required';

function requestId(value: unknown): string {
  const candidate = text(value, 80).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)) {
    throw new Error('test_request_id_invalid');
  }
  return candidate;
}

async function directTestFingerprint(phone: string, message: string): Promise<string> {
  const value = new TextEncoder().encode(`${phone}\u0000${message}`);
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function rpcStatus(value: unknown): DirectTestReservationStatus | null {
  const row = Array.isArray(value) ? value[0] : value;
  const status = object(row).status;
  return status === 'reserved' || status === 'provider_accepted' || status === 'reconciliation_required'
    ? status
    : null;
}

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
    const body = await request.json().catch(() => ({})) as {
      phone?: unknown;
      message?: unknown;
      confirmation?: unknown;
      request_id?: unknown;
    };
    if (body.confirmation !== 'SEND_REAL_WHATSAPP_TEST') throw new Error('test_message_confirmation_required');
    const idempotencyRequestId = requestId(body.request_id);
    const phone = whatsappPhone(body.phone);
    const message = text(body.message, 600);
    if (!message) throw new Error('test_message_required');
    const fingerprint = await directTestFingerprint(phone, message);

    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner', 'admin', 'manager']);

    const { data: providerControl, error: providerControlError } = await admin.from('messaging_provider_controls')
      .select('send_enabled,kill_switch').eq('organization_id', organizationId).eq('provider', 'zapi').maybeSingle();
    if (providerControlError) throw new Error('provider_control_read_failed');
    const hasExplicitProviderControl = providerControl
      && typeof providerControl.send_enabled === 'boolean'
      && typeof providerControl.kill_switch === 'boolean';
    if (hasExplicitProviderControl && (providerControl.send_enabled !== true || providerControl.kill_switch === true)) {
      throw new Error('whatsapp_provider_disabled');
    }

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

    // This reservation is intentionally persisted immediately before send-text.
    // A retry with this request_id, or with an unresolved matching payload under
    // a different request_id, must never create a second external WhatsApp send.
    const { data: reservation, error: reservationError } = await admin.rpc('reserve_whatsapp_direct_test', {
      p_organization_id: organizationId,
      p_actor_id: user.id,
      p_actor_name: text(profile.name, 160) || 'Usuário',
      p_integration_id: integration.id,
      p_request_id: idempotencyRequestId,
      p_phone_suffix: phone.slice(-4),
      p_message_length: message.length,
      p_test_fingerprint: fingerprint,
    });
    const reservationStatus = rpcStatus(reservation);
    if (reservationError || !reservationStatus) throw new Error('whatsapp_test_reservation_failed');
    if (reservationStatus === 'provider_accepted') {
      return json({
        ok: true,
        providerAccepted: true,
        duplicate: true,
        resendBlocked: true,
        deliveryConfirmed: false,
        readConfirmed: false,
        phoneSuffix: phone.slice(-4),
        mensagem: 'Este teste já foi aceito pela Z-API. O envio não foi repetido; entrega e leitura não foram confirmadas.',
      }, 200, headers);
    }
    if (reservationStatus === 'reconciliation_required') {
      return json({
        ok: false,
        providerAccepted: false,
        reconciliationRequired: true,
        resendBlocked: true,
        phoneSuffix: phone.slice(-4),
        mensagem: 'Há uma tentativa anterior sem confirmação interna conclusiva. O envio não foi repetido.',
      }, 409, headers);
    }

    const sendResponse = await fetch(`${baseUrl}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/send-text`, {
      method: 'POST', headers: headersToProvider, body: JSON.stringify({ phone, message }), signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
    const receipt = await sendResponse.json().catch(() => null) as { messageId?: unknown } | null;
    if (!sendResponse.ok) throw new Error(failureCode(sendResponse.status));
    if (typeof receipt?.messageId !== 'string' || !receipt.messageId) throw new Error('zapi_test_receipt_missing');

    // Do not retain the provider receipt or the test text in audit metadata. The
    // RPC records only masked, minimal reconciliation evidence.
    const { data: acceptance, error: acceptanceError } = await admin.rpc('record_whatsapp_direct_test_provider_acceptance', {
      p_organization_id: organizationId,
      p_integration_id: integration.id,
      p_request_id: idempotencyRequestId,
    });
    if (acceptanceError || rpcStatus(acceptance) !== 'provider_accepted') {
      return json({
        ok: true,
        providerAccepted: true,
        reconciliationRequired: true,
        resendBlocked: true,
        deliveryConfirmed: false,
        readConfirmed: false,
        phoneSuffix: phone.slice(-4),
        mensagem: 'A mensagem foi aceita pela Z-API, mas o registro interno precisa de conciliação. Não reenvie este teste.',
      }, 202, headers);
    }

    const now = new Date().toISOString();
    const { error: healthError } = await admin.from('integrations').update({
      connected: true, enabled: true, paused: false,
      status_detail: 'Conexão Z-API validada. A última mensagem de teste foi aceita pelo provedor.',
      last_tested_at: now, last_success_at: now, last_error: null, last_error_at: null, updated_at: now,
    }).eq('id', integration.id).eq('organization_id', organizationId);

    return json({
      ok: true,
      providerAccepted: true,
      resendBlocked: true,
      deliveryConfirmed: false,
      readConfirmed: false,
      statusUpdated: !healthError,
      phoneSuffix: phone.slice(-4),
      mensagem: healthError
        ? 'Mensagem de teste aceita pela Z-API. A atualização de status será conciliada; entrega e leitura não foram confirmadas.'
        : 'Mensagem de teste aceita pela Z-API. Entrega e leitura não foram confirmadas.',
    }, healthError ? 202 : 200, headers);
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
