import { createAdminClient, hasOrganizationPermission, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { WaAkgProvider, normalizeWaAkgBaseUrl } from '../_shared/messaging/WaAkgProvider.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
type Actor = { organizationId: string; userId: string; name: string; canManage: boolean; canViewOwn: boolean; canConnectOwn: boolean };
type RecordSet = { account: Row; integration: Row; controls: Row | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 1_000): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
const uuid = (value: unknown): string => UUID.test(text(value, 80)) ? text(value, 80) : '';

function allowedOrigins(): string[] {
  return (Deno.env.get('WA_AKG_ALLOWED_ORIGINS') ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean);
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sessionName(userId: string): string {
  return `seller_${userId.replace(/-/g, '')}`;
}

function phoneSuffix(value: string | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function callbackUrl(integrationId: string): string {
  const url = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-wa-akg`);
  url.searchParams.set('integration_id', integrationId);
  return url.toString();
}

async function actorContext(admin: Admin, userId: string): Promise<Actor> {
  const { data: profile, error } = await admin.from('profiles')
    .select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = String(profile.active_organization_id);
  const { data: member, error: memberError } = await admin.from('organization_members')
    .select('status').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (memberError || member?.status !== 'active') throw new Error('organization_access_denied');
  const [manageAll, manageConfig, canViewOwn, canConnectOwn] = await Promise.all([
    hasOrganizationPermission(admin, organizationId, userId, 'channels.manage_all'),
    hasOrganizationPermission(admin, organizationId, userId, 'configuration.manage'),
    hasOrganizationPermission(admin, organizationId, userId, 'channels.view_own'),
    hasOrganizationPermission(admin, organizationId, userId, 'channels.connect_own'),
  ]);
  return {
    organizationId, userId, name: text(profile.name, 160) || 'Usuário',
    canManage: manageAll || manageConfig, canViewOwn, canConnectOwn,
  };
}

async function secretFor(admin: Admin, integrationId: string): Promise<Row> {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error) throw new Error('wa_akg_secret_read_failed');
  return object(data);
}

async function recordFor(admin: Admin, organizationId: string, accountId: string): Promise<RecordSet | null> {
  const { data: account, error } = await admin.from('whatsapp_accounts')
    .select('id,integration_id,owner_user_id,label,provider,account_type,enabled,is_default,connection_status,connected_phone_suffix,connected_at,status_checked_at,webhook_registered_at,last_error_code,provider_metadata,messaging_mode')
    .eq('organization_id', organizationId).eq('id', accountId).eq('provider', 'wa_akg').is('archived_at', null).maybeSingle();
  if (error) throw new Error('wa_akg_account_lookup_failed');
  if (!account) return null;
  const { data: integration, error: integrationError } = await admin.from('integrations')
    .select('id,label,provider,connected,enabled,paused,last_tested_at,last_success_at,status_detail,configuration')
    .eq('organization_id', organizationId).eq('id', account.integration_id).maybeSingle();
  if (integrationError || !integration) throw new Error('wa_akg_integration_lookup_failed');
  const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
    .select('inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,min_delay_seconds,max_delay_seconds,burst_limit,burst_window_seconds,daily_limit,updated_at')
    .eq('organization_id', organizationId).eq('provider', 'wa_akg').maybeSingle();
  if (controlsError) throw new Error('wa_akg_controls_lookup_failed');
  return { account, integration, controls };
}

function owner(record: RecordSet, actor: Actor): boolean {
  return record.account.account_type === 'seller' && record.account.owner_user_id === actor.userId;
}

function canView(record: RecordSet, actor: Actor): boolean {
  return actor.canManage || (owner(record, actor) && actor.canViewOwn)
    || (record.account.account_type === 'corporate' && record.account.is_default === true);
}

function canConnect(record: RecordSet, actor: Actor): boolean {
  return actor.canManage || (owner(record, actor) && actor.canConnectOwn);
}

async function accessible(admin: Admin, actor: Actor, accountId: string, level: 'view' | 'connect' | 'manage'): Promise<RecordSet> {
  const record = await recordFor(admin, actor.organizationId, accountId);
  if (!record) throw new Error('wa_akg_account_not_found');
  const allowed = level === 'manage' ? actor.canManage : level === 'connect' ? canConnect(record, actor) : canView(record, actor);
  if (!allowed) throw new Error('wa_akg_account_not_found');
  return record;
}

async function listRecords(admin: Admin, actor: Actor): Promise<RecordSet[]> {
  let query = admin.from('whatsapp_accounts').select('id,owner_user_id,account_type,is_default')
    .eq('organization_id', actor.organizationId).eq('provider', 'wa_akg').is('archived_at', null).order('label');
  if (!actor.canManage) query = query.eq('owner_user_id', actor.userId).eq('account_type', 'seller');
  const { data, error } = await query;
  if (error) throw new Error('wa_akg_accounts_lookup_failed');
  const records = await Promise.all((data ?? []).map((item) => recordFor(admin, actor.organizationId, String(item.id))));
  return records.filter((record): record is RecordSet => Boolean(record && canView(record, actor)));
}

async function ownRecord(admin: Admin, actor: Actor): Promise<RecordSet | null> {
  const { data, error } = await admin.from('whatsapp_accounts').select('id')
    .eq('organization_id', actor.organizationId).eq('provider', 'wa_akg').eq('account_type', 'seller')
    .eq('owner_user_id', actor.userId).is('archived_at', null).maybeSingle();
  if (error) throw new Error('wa_akg_own_account_lookup_failed');
  return data ? recordFor(admin, actor.organizationId, String(data.id)) : null;
}

function publicStatus(record: RecordSet, actor: Actor) {
  const configuration = object(record.integration.configuration);
  const controls = record.controls ?? {};
  return {
    configured: configuration.configured === true,
    account: {
      id: record.account.id, label: record.account.label, accountType: record.account.account_type,
      ownerUserId: record.account.owner_user_id ?? null, enabled: record.account.enabled === true,
      isDefault: record.account.is_default === true, connectionStatus: record.account.connection_status,
      phoneSuffix: record.account.connected_phone_suffix ?? null, connectedAt: record.account.connected_at ?? null,
      checkedAt: record.account.status_checked_at ?? null, webhookRegisteredAt: record.account.webhook_registered_at ?? null,
      errorCode: record.account.last_error_code ?? null, messagingMode: record.account.messaging_mode ?? 'suggestion',
    },
    integration: {
      id: record.integration.id, connected: record.integration.connected === true,
      enabled: record.integration.enabled === true, paused: record.integration.paused === true,
      statusDetail: record.integration.status_detail ?? null, lastTestedAt: record.integration.last_tested_at ?? null,
      lastSuccessAt: record.integration.last_success_at ?? null,
      baseUrlConfigured: configuration.base_url_configured === true,
      sessionName: configuration.session_name ?? null, version: configuration.provider_version ?? null,
    },
    controls: {
      inboundEnabled: controls.inbound_enabled === true, sendEnabled: controls.send_enabled === true,
      automationEnabled: controls.automation_enabled === true, killSwitch: controls.kill_switch !== false,
      reason: controls.reason ?? null, minDelaySeconds: controls.min_delay_seconds ?? 10,
      maxDelaySeconds: controls.max_delay_seconds ?? 30, burstLimit: controls.burst_limit ?? 3,
      burstWindowSeconds: controls.burst_window_seconds ?? 60, dailyLimit: controls.daily_limit ?? 100,
    },
    canManage: actor.canManage, canConnect: canConnect(record, actor), canViewQr: canConnect(record, actor),
  };
}

async function corporateCredentials(admin: Admin, organizationId: string): Promise<Row> {
  const { data, error } = await admin.from('whatsapp_accounts').select('integration_id')
    .eq('organization_id', organizationId).eq('provider', 'wa_akg').eq('account_type', 'corporate')
    .is('archived_at', null).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error('wa_akg_gateway_lookup_failed');
  const stored = data?.integration_id ? await secretFor(admin, String(data.integration_id)) : {};
  const baseUrl = text(stored.base_url, 500) || text(Deno.env.get('WA_AKG_BASE_URL'), 500);
  const apiKey = text(stored.api_key, 1_000) || text(Deno.env.get('WA_AKG_API_KEY'), 1_000);
  if (!baseUrl || !apiKey) throw new Error('wa_akg_gateway_not_configured');
  return { base_url: normalizeWaAkgBaseUrl(baseUrl, allowedOrigins()), api_key: apiKey };
}

async function providerFor(admin: Admin, organizationId: string, record: RecordSet): Promise<{ provider: WaAkgProvider; secret: Row }> {
  const ownSecret = await secretFor(admin, String(record.integration.id));
  const gateway = await corporateCredentials(admin, organizationId);
  const sessionId = text(ownSecret.session_id, 120) || text(object(record.integration.configuration).session_name, 120);
  if (!sessionId) throw new Error('wa_akg_session_not_provisioned');
  return {
    provider: new WaAkgProvider({
      baseUrl: text(gateway.base_url, 500), apiKey: text(gateway.api_key, 1_000), sessionId,
      allowedOrigins: allowedOrigins(), timeoutMs: Number(ownSecret.timeout_ms) || undefined,
    }),
    secret: { ...ownSecret, ...gateway, session_id: sessionId },
  };
}

async function storeSecret(admin: Admin, integrationId: string, value: Row): Promise<void> {
  const { error } = await admin.rpc('store_integration_secret', { p_integration: integrationId, p_secret: value });
  if (error) throw new Error('wa_akg_secret_save_failed');
}

async function audit(admin: Admin, actor: Actor, action: string, accountId: string, detail: string, data: Row = {}) {
  await admin.from('audit_logs').insert({
    organization_id: actor.organizationId, actor_id: actor.userId, actor_name: actor.name, actor_type: 'user',
    action, detail, entity_table: 'whatsapp_accounts', entity_id: accountId,
    event_data: { provider: 'wa_akg', ...data },
  });
}

async function closeControls(admin: Admin, actor: Actor, reason: string) {
  const { count, error } = await admin.from('whatsapp_accounts').select('*', { count: 'exact', head: true })
    .eq('organization_id', actor.organizationId).eq('provider', 'wa_akg').eq('enabled', true)
    .eq('connection_status', 'connected').is('archived_at', null);
  if (error) throw new Error('wa_akg_active_accounts_lookup_failed');
  if ((count ?? 0) > 0) return;
  const { error: updateError } = await admin.from('messaging_provider_controls').upsert({
    organization_id: actor.organizationId, provider: 'wa_akg', inbound_enabled: false, send_enabled: false,
    automation_enabled: false, kill_switch: true, reason, changed_by: actor.userId,
  }, { onConflict: 'organization_id,provider' });
  if (updateError) throw new Error('wa_akg_controls_save_failed');
}

async function provision(admin: Admin, actor: Actor, record: RecordSet): Promise<RecordSet> {
  if (record.account.account_type !== 'seller') throw new Error('wa_akg_seller_account_required');
  const gateway = await corporateCredentials(admin, actor.organizationId);
  const existing = await secretFor(admin, String(record.integration.id));
  const sessionId = text(existing.session_id, 120) || sessionName(String(record.account.owner_user_id));
  const webhookSecret = text(existing.webhook_secret, 256) || randomSecret();
  const secret = { ...existing, session_id: sessionId, webhook_secret: webhookSecret, timeout_ms: 15_000 };
  await storeSecret(admin, String(record.integration.id), secret);
  const provider = new WaAkgProvider({
    baseUrl: text(gateway.base_url, 500), apiKey: text(gateway.api_key, 1_000), sessionId,
    allowedOrigins: allowedOrigins(), timeoutMs: 15_000,
  });
  if (existing.remote_created !== true) {
    try { await provider.create(text(record.account.label, 120) || 'WhatsApp do vendedor'); }
    catch (error) { if (safeError(error) !== 'wa_akg_request_rejected_409') throw error; }
  }
  await provider.configureSafety();
  await provider.registerWebhook(callbackUrl(String(record.integration.id)), webhookSecret);
  await provider.start();
  await storeSecret(admin, String(record.integration.id), { ...secret, remote_created: true, webhook_registered: true });

  const { data: storedIntegration } = await admin.from('integrations').select('configuration')
    .eq('id', record.integration.id).eq('organization_id', actor.organizationId).maybeSingle();
  const now = new Date().toISOString();
  const [integrationUpdate, accountUpdate] = await Promise.all([
    admin.from('integrations').update({
      connected: false, enabled: false, paused: true,
      status_detail: 'Sessão WA-AKG criada; leia o QR Code em Meu WhatsApp.',
      configuration: { ...object(storedIntegration?.configuration), configured: true, base_url_configured: true,
        session_name: sessionId, provider_version: '1.7.0-beta.1' }, updated_at: now,
    }).eq('id', record.integration.id).eq('organization_id', actor.organizationId),
    admin.from('whatsapp_accounts').update({
      connection_status: 'qr', enabled: false, webhook_registered_at: now, status_checked_at: now,
      last_error_code: null, provider_metadata: { session_name: sessionId, provider_version: '1.7.0-beta.1' }, updated_at: now,
    }).eq('id', record.account.id).eq('organization_id', actor.organizationId),
  ]);
  if (integrationUpdate.error || accountUpdate.error) throw new Error('wa_akg_provision_state_save_failed');
  const { error: jobUpdateError } = await admin.from('wa_akg_seller_provisioning_jobs').update({
    state: 'completed', completed_at: now, last_error: null, locked_at: null, locked_by: null,
  }).eq('organization_id', actor.organizationId).eq('account_id', record.account.id)
    .in('state', ['queued', 'processing', 'failed', 'needs_review']);
  if (jobUpdateError) throw new Error('wa_akg_provision_job_complete_failed');
  await closeControls(admin, actor, 'account_connection_pending');
  const updated = await recordFor(admin, actor.organizationId, String(record.account.id));
  if (!updated) throw new Error('wa_akg_record_missing');
  return updated;
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  let action = '';
  try {
    const body = object(await request.json().catch(() => ({})));
    action = text(body.action, 80);
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const actor = await actorContext(admin, user.id);

    if (action === 'list') {
      const records = await listRecords(admin, actor);
      return json({ ok: true, accounts: records.map((record) => publicStatus(record, actor)), canManage: actor.canManage }, 200, headers);
    }
    if (action === 'my_account') {
      const record = await ownRecord(admin, actor);
      return json({ ok: true, ...(record ? publicStatus(record, actor) : {
        configured: false, account: null, integration: null, controls: null,
        canManage: false, canConnect: false, canViewQr: false,
      }) }, 200, headers);
    }

    if (action === 'configure_gateway') {
      if (!actor.canManage) throw new Error('permission_denied');
      const baseUrl = normalizeWaAkgBaseUrl(text(body.base_url, 500), allowedOrigins());
      const apiKey = text(body.api_key, 1_000);
      if (!apiKey) throw new Error('wa_akg_api_key_required');
      const { data: existing } = await admin.from('whatsapp_accounts').select('id,integration_id')
        .eq('organization_id', actor.organizationId).eq('provider', 'wa_akg').eq('account_type', 'corporate')
        .is('archived_at', null).limit(1).maybeSingle();
      let accountId = existing?.id ? String(existing.id) : crypto.randomUUID();
      let integrationId = existing?.integration_id ? String(existing.integration_id) : crypto.randomUUID();
      if (!existing) {
        const label = text(body.label, 120) || 'WA-AKG principal';
        const { error: integrationError } = await admin.from('integrations').insert({
          id: integrationId, organization_id: actor.organizationId, key: `whatsapp_wa_akg:${accountId}`,
          label, provider: 'WA-AKG', category: 'communication', connected: false, enabled: false, paused: true,
          mode: 'real', status_detail: 'Gateway WA-AKG configurado; aguardando validação.',
          configuration: { configured: true, base_url_configured: true, provider_version: '1.7.0-beta.1' },
        });
        if (integrationError) throw new Error('wa_akg_gateway_create_failed');
        const { error: accountError } = await admin.from('whatsapp_accounts').insert({
          id: accountId, organization_id: actor.organizationId, integration_id: integrationId,
          label, provider: 'wa_akg', account_type: 'corporate', is_default: false, enabled: false,
          connection_status: 'configured', created_by: actor.userId,
          provider_metadata: { provider_version: '1.7.0-beta.1' },
        });
        if (accountError) throw new Error('wa_akg_gateway_create_failed');
      }
      await storeSecret(admin, integrationId, { base_url: baseUrl, api_key: apiKey });
      await admin.from('messaging_provider_controls').upsert({
        organization_id: actor.organizationId, provider: 'wa_akg', inbound_enabled: false,
        send_enabled: false, automation_enabled: false, kill_switch: true,
        reason: 'gateway_configured_pending_validation', changed_by: actor.userId,
      }, { onConflict: 'organization_id,provider' });
      await audit(admin, actor, 'whatsapp.wa_akg_gateway_configured', accountId,
        'Gateway WA-AKG salvo no cofre; nenhum envio foi ativado.');
      const record = await recordFor(admin, actor.organizationId, accountId);
      if (!record) throw new Error('wa_akg_record_missing');
      return json({ ok: true, ...publicStatus(record, actor) }, 200, headers);
    }

    if (action === 'create_account') {
      if (!actor.canManage) throw new Error('permission_denied');
      const ownerUserId = uuid(body.owner_user_id);
      if (!ownerUserId) throw new Error('wa_akg_account_owner_required');
      const { data, error } = await admin.rpc('enqueue_wa_akg_seller_provisioning', {
        p_organization_id: actor.organizationId, p_user_id: ownerUserId, p_created_by: actor.userId,
        p_source: 'manual', p_invite_id: null,
      });
      const row = object(Array.isArray(data) ? data[0] : data);
      if (error || !row.whatsapp_account_id) throw new Error('wa_akg_provisioning_enqueue_failed');
      const record = await accessible(admin, actor, String(row.whatsapp_account_id), 'manage');
      return json({ ok: true, ...publicStatus(record, actor), provisioningState: row.state }, 200, headers);
    }

    const accountId = uuid(body.account_id);
    if (!accountId) throw new Error('wa_akg_account_required');
    if (action === 'status') {
      const record = await accessible(admin, actor, accountId, 'view');
      return json({ ok: true, ...publicStatus(record, actor) }, 200, headers);
    }
    if (action === 'provision') {
      const current = await accessible(admin, actor, accountId, 'manage');
      const updated = await provision(admin, actor, current);
      await audit(admin, actor, 'whatsapp.wa_akg_session_provisioned', accountId,
        'Sessão individual WA-AKG criada com automações internas desativadas e webhook registrado.');
      return json({ ok: true, ...publicStatus(updated, actor) }, 200, headers);
    }

    const record = await accessible(admin, actor, accountId, 'connect');
    const { provider } = await providerFor(admin, actor.organizationId, record);
    const now = new Date().toISOString();

    if (action === 'connect') {
      await provider.start();
      await admin.from('whatsapp_accounts').update({ connection_status: 'qr', enabled: false, status_checked_at: now })
        .eq('id', accountId).eq('organization_id', actor.organizationId);
      await closeControls(admin, actor, 'account_connection_pending');
    } else if (action === 'qr') {
      const state = await provider.status();
      if (state.connected) throw new Error('wa_akg_session_already_connected');
      if (!['SCAN_QR', 'QR'].includes(state.state)) await provider.start();
      let result: { qrcode: string } | null = null;
      for (let attempt = 0; attempt < 5 && !result; attempt += 1) {
        try { result = await provider.qr(); }
        catch (error) {
          if (attempt === 4) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1_500));
        }
      }
      return json({ ok: true, qr: { qrcode: result?.qrcode ?? null, code: null, expiresAt: null } }, 200,
        { ...headers, 'Cache-Control': 'no-store' });
    } else if (action === 'pair') {
      const pairingCode = await provider.pair(text(body.phone, 32));
      return json({ ok: true, pairingCode }, 200, { ...headers, 'Cache-Control': 'no-store' });
    } else if (action === 'refresh_status') {
      const state = await provider.status();
      const connected = state.connected;
      const [accountUpdate, integrationUpdate] = await Promise.all([
        admin.from('whatsapp_accounts').update({
          connection_status: connected ? 'connected' : state.state === 'SCAN_QR' ? 'qr' : 'disconnected',
          connected_phone_suffix: phoneSuffix(state.phone), connected_at: connected ? now : null,
          status_checked_at: now, enabled: connected ? record.account.enabled === true : false,
          last_error_code: null,
        }).eq('id', accountId).eq('organization_id', actor.organizationId),
        admin.from('integrations').update({
          connected, enabled: connected ? record.integration.enabled === true : false,
          paused: connected ? record.integration.paused === true : true,
          last_tested_at: now, last_success_at: connected ? now : null,
          status_detail: connected ? 'WA-AKG confirmou a conexão desta sessão.' : 'Sessão aguardando conexão do WhatsApp.',
        }).eq('id', record.integration.id).eq('organization_id', actor.organizationId),
      ]);
      if (accountUpdate.error || integrationUpdate.error) throw new Error('wa_akg_status_save_failed');
      await closeControls(admin, actor, 'account_connection_unavailable');
    } else if (action === 'reconnect') {
      await provider.restart();
      await admin.from('whatsapp_accounts').update({ connection_status: 'qr', enabled: false, status_checked_at: now })
        .eq('id', accountId).eq('organization_id', actor.organizationId);
      await closeControls(admin, actor, 'account_reconnect_requested');
    } else if (action === 'disconnect' || action === 'logout') {
      if (action === 'logout') await provider.logout(); else await provider.stop();
      await Promise.all([
        admin.from('whatsapp_accounts').update({ enabled: false, is_default: false, connection_status: 'disconnected', status_checked_at: now })
          .eq('id', accountId).eq('organization_id', actor.organizationId),
        admin.from('integrations').update({ connected: false, enabled: false, paused: true, status_detail: 'Sessão WA-AKG desconectada.' })
          .eq('id', record.integration.id).eq('organization_id', actor.organizationId),
      ]);
      await closeControls(admin, actor, action);
    } else if (action === 'activate') {
      const state = await provider.status();
      if (!state.connected) throw new Error('wa_akg_connection_validation_required');
      await Promise.all([
        admin.from('whatsapp_accounts').update({
          enabled: true, connection_status: 'connected', connected_phone_suffix: phoneSuffix(state.phone),
          connected_at: now, status_checked_at: now, last_error_code: null,
        }).eq('id', accountId).eq('organization_id', actor.organizationId),
        admin.from('integrations').update({
          connected: true, enabled: true, paused: false, last_tested_at: now, last_success_at: now,
          status_detail: 'Canal WA-AKG operacional. A Ana respeita o modo automático, opt-out e transferência humana.',
        }).eq('id', record.integration.id).eq('organization_id', actor.organizationId),
        admin.from('messaging_provider_controls').upsert({
          organization_id: actor.organizationId, provider: 'wa_akg', inbound_enabled: true,
          send_enabled: true, automation_enabled: true, kill_switch: false,
          reason: 'validated_account_activated', changed_by: actor.userId,
        }, { onConflict: 'organization_id,provider' }),
      ]);
      await audit(admin, actor, 'whatsapp.wa_akg_activated', accountId,
        'Canal WA-AKG ativado; a automação permanece subordinada às políticas publicadas da Ana.');
    } else if (action === 'deactivate') {
      await Promise.all([
        admin.from('whatsapp_accounts').update({ enabled: false, is_default: false })
          .eq('id', accountId).eq('organization_id', actor.organizationId),
        admin.from('integrations').update({ enabled: false, paused: true, status_detail: 'Canal desativado; sessão preservada.' })
          .eq('id', record.integration.id).eq('organization_id', actor.organizationId),
      ]);
      await closeControls(admin, actor, 'account_disabled_by_operator');
    } else if (action === 'save_controls') {
      if (!actor.canManage) throw new Error('permission_denied');
      const minDelay = Math.min(Math.max(Number(body.min_delay_seconds) || 10, 10), 300);
      const maxDelay = Math.min(Math.max(Number(body.max_delay_seconds) || 30, minDelay), 600);
      const burstLimit = Math.min(Math.max(Number(body.burst_limit) || 3, 1), 20);
      const dailyLimit = Math.min(Math.max(Number(body.daily_limit) || 100, 1), 5_000);
      const { error } = await admin.from('messaging_provider_controls').update({
        min_delay_seconds: minDelay, max_delay_seconds: maxDelay, burst_limit: burstLimit,
        burst_window_seconds: 60, daily_limit: dailyLimit, changed_by: actor.userId,
      }).eq('organization_id', actor.organizationId).eq('provider', 'wa_akg');
      if (error) throw new Error('wa_akg_controls_save_failed');
    } else {
      throw new Error('unsupported_action');
    }

    const updated = await recordFor(admin, actor.organizationId, accountId);
    if (!updated) throw new Error('wa_akg_record_missing');
    return json({ ok: true, ...publicStatus(updated, actor) }, 200, headers);
  } catch (error) {
    const code = safeError(error).replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 120);
    console.error('wa_akg_action_failed', { action, code });
    return json({ ok: false, error: code }, 400, headers);
  }
});
